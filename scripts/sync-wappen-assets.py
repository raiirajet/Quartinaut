#!/usr/bin/env python3
"""Create a BFS-verified, offline-friendly Swiss coat-of-arms cache at build time.

This script only uses Wikimedia Commons material explicitly linked by Wikidata
P771 (official BFS municipality identifier) and P94 (coat of arms image).
Never invent an image from a municipality name. The app continues to work
without external services if Wikidata or Commons temporarily fails.
"""
import concurrent.futures
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app/src/main/assets/q-original/ch-locations-2026.json"
OUT = ROOT / "app/src/main/assets/wappen"
UA = "Quartinaut/5.8 (https://github.com/raiirajet/Quartinaut; noncommercial civic reference)"
# Only explicitly checked Commons filenames are added without SPARQL.
VERIFIED = {"311": "CHE Schüpfen BE COA.svg", "3401": "CHE Degersheim COA.svg", "3402": "CHE Flawil COA.svg"}
# Haute-Ajoie (6809) has no common coat of arms: the five constituent
# villages retain their own. See https://hauteajoie.ch/ and RFJ 03.10.2022.
NO_COAT_BFS = "6809"

def request(url, timeout=22):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "application/json, image/svg+xml, */*"
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()

def commons_filename(url):
    value = str(url or "")
    parsed = urllib.parse.urlparse(value)
    if parsed.hostname not in ("commons.wikimedia.org", "upload.wikimedia.org"):
        return None
    path = urllib.parse.unquote(parsed.path)
    if "Special:FilePath/" in path:
        filename = path.split("Special:FilePath/", 1)[1]
    elif "/File:" in path:
        filename = path.split("/File:", 1)[1]
    else:
        filename = path.rsplit("/", 1)[-1]
    filename = filename.replace("_", " ").strip()
    # P94 is not always SVG! About 70 Swiss municipalities have PNG/JPEG
    # arms; the original SVG-only filter silently discarded those records.
    ext = Path(filename).suffix.lower()
    if ext not in (".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"):
        return None
    if len(filename) > 200 or "/" in filename:
        return None
    return filename

def url_for(filename):
    canonical = filename.replace(" ", "_")
    digest = hashlib.md5(canonical.encode("utf-8")).hexdigest()
    return "https://upload.wikimedia.org/wikipedia/commons/{}/{}/{}".format(
        digest[0], digest[:2], urllib.parse.quote(canonical, safe="()_,.-")
    )

def file_page_for(filename):
    return ("https://commons.wikimedia.org/wiki/Special:FilePath/" +
            urllib.parse.quote(filename.replace(" ", "_"), safe="()_,.-"))


def wikidata_index(valid_ids):
    # One registry-validated P771/P94 lookup; avoid per-device API throttling.
    sparql = """
        SELECT ?bfs ?coat WHERE {
          ?municipality wdt:P771 ?bfs ;
                        wdt:P94 ?coat.
        }
    """
    endpoint = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(sparql)
    for attempt in range(2):
        try:
            payload = json.loads(request(endpoint, timeout=34))
            found = {}
            for record in payload.get("results", {}).get("bindings", []):
                bfs = record.get("bfs", {}).get("value", "")
                image = record.get("coat", {}).get("value", "")
                filename = commons_filename(image)
                if bfs in valid_ids and filename:
                    found[bfs] = filename
            print("Wikidata: {} BFS-validated coat URLs".format(len(found)))
            return found
        except (ValueError, OSError, KeyError) as exc:
            print("Wikidata request {} failed: {}".format(attempt + 1, str(exc)[:140]))
            time.sleep(2)
    return {}

def thumbnail_index(filenames):
    """Fetch the Commons imageinfo service in batches (not 2100 API calls).

    The thumbnail URLs are already rasterized and served through Wikimedia's
    image CDN, substantially reducing SVG parsing and redirect failures.
    """
    results = {}
    reverse = {}
    for bfs, file in filenames.items():
        reverse.setdefault(file.replace("_", " ").casefold(), []).append(bfs)
    unique = list({file.replace("_", " "): None for file in filenames.values()})
    batches = [unique[i:i+40] for i in range(0, len(unique), 40)]

    def one(batch):
        titles = "|".join("File:" + x for x in batch)
        params = urllib.parse.urlencode({
            "action": "query", "format": "json", "formatversion": "2",
            "prop": "imageinfo", "iiprop": "url", "iiurlwidth": "112",
            "redirects": "1", "titles": titles
        })
        url = "https://commons.wikimedia.org/w/api.php?" + params
        try:
            payload = json.loads(request(url, timeout=15))
            found = {}
            query = payload.get("query", {})
            redirs = {r["from"].removeprefix("File:").casefold():
                      r["to"].removeprefix("File:").casefold()
                      for r in query.get("redirects", [])}
            redirects_back = {}
            for source,target in redirs.items():
                redirects_back.setdefault(target, []).append(source)
            for page in query.get("pages", []):
                file = str(page.get("title", "")).removeprefix("File:").replace("_", " ")
                info = (page.get("imageinfo") or [{}])[0]
                asset = info.get("thumburl") or info.get("url")
                if not asset: continue
                parsed = urllib.parse.urlparse(asset)
                if parsed.scheme != "https" or parsed.hostname != "upload.wikimedia.org":
                    continue
                keys = [file.casefold()] + redirects_back.get(file.casefold(), [])
                for key in keys:
                    for bfs in reverse.get(key, []): found[bfs] = asset
            return found
        except (OSError, ValueError, KeyError, TypeError):
            return {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        for chunk in pool.map(one, batches):
            results.update(chunk)
    print("Commons thumbnails: {}/{} BFS images".format(len(results),len(filenames)))
    return results

def valid_image(raw):
    """Reject HTML, empty responses and garbage rather than packaging broken assets."""
    if not raw or len(raw)>1_200_000:
        return None
    if raw.startswith(b"\x89PNG\r\n\x1a\n") and len(raw)>32:
        return ".png"
    if raw.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if raw[:4]==b"RIFF" and raw[8:12]==b"WEBP":
        return ".webp"
    if raw.startswith(b"GIF8"):
        return ".gif"
    header=raw[:8192].lstrip().lower()
    if b"<svg" in header and b"<html" not in header and b"<!doctype html" not in header:
        return ".svg"
    return None

def cached_image(bfs):
    for ext in (".png",".svg",".jpg",".jpeg",".webp",".gif"):
        path=OUT/(bfs+ext)
        if path.is_file() and valid_image(path.read_bytes())==ext:
            return True
        if path.is_file():
            path.unlink() # Bad cached data must never pass validation.
    return False

def proxy_url(origin,host):
    return "https://"+host+"/?"+urllib.parse.urlencode({
        "url":origin, "w":"128", "output":"png"
    })

def download_coat(entry):
    bfs,filename=entry
    if cached_image(bfs):
        return True
    origin=url_for(filename)
    # Wikimedia's CDN returned HTTP 429 after just 10-15 requests from a
    # shared GitHub Actions IP (confirmed 14 Nov 2026). Instead, rasterize
    # the *same sourced Commons file* at build-time through an image proxy.
    # No proxy or network requests occur on the user's device for bundled art.
    urls=[
        proxy_url(origin,"wsrv.nl"),
        proxy_url(origin,"images.weserv.nl"),
        origin,
        file_page_for(filename),
    ]
    for ix,url in enumerate(urls):
        for attempt in range(2 if ix<2 else 1):
            try:
                raw=request(url,timeout=22)
                ext=valid_image(raw)
                if not ext:
                    continue
                target=OUT/(bfs+ext)
                tmp=OUT/(bfs+ext+".part")
                tmp.write_bytes(raw)
                tmp.replace(target)
                return True
            except (OSError,ValueError) as exc:
                if attempt==0 and ix<2:
                    time.sleep(1.0)
    return False

def download_logo_haute_ajoie():
    """Get the community's own mark, not an invented heraldic shield."""
    import html.parser
    from urllib.parse import urljoin
    if cached_image(NO_COAT_BFS):
        return True
    try:
        page=request("https://hauteajoie.ch/",timeout=18).decode("utf-8","replace")
    except OSError:
        return False
    class Images(html.parser.HTMLParser):
        def __init__(self):
            super().__init__(); self.candidates=[]
        def handle_starttag(self,tag,attrs):
            if tag not in ("img","source"):
                return
            d=dict(attrs)
            key=" ".join(str(d.get(k,"")) for k in ("src","data-src","alt","class")).lower()
            if "logo" in key:
                for k in ("data-src","src"):
                    if d.get(k):self.candidates.append(urljoin("https://hauteajoie.ch/",d[k]))
    parsed=Images();parsed.feed(page)
    for link in parsed.candidates:
        u=urllib.parse.urlparse(link)
        if u.scheme!="https" or u.hostname not in ("hauteajoie.ch","www.hauteajoie.ch"):
            continue
        try:
            raw=request(link,timeout=15)
            ext=valid_image(raw)
            if ext and len(raw)<800_000:
                (OUT/(NO_COAT_BFS+ext)).write_bytes(raw)
                return True
        except OSError:
            pass
    return False

def import_legacy(valid_ids):
    """Fill gaps from the 2018 BFS-ID-labelled archival collection.
    Existing 2026 downloads are never overwritten. Archive art is clearly
    attributed as older imagery; this is not proof of a 2026 heraldic revision.
    """
    from PIL import Image, UnidentifiedImageError
    archive=ROOT/".cache/legacy-coats/coat of arms - 500px"
    csv_file=ROOT/".cache/legacy-coats/imagesource.csv"
    meta_file=OUT/"legacy-sources.json"
    previous=json.loads(meta_file.read_text(encoding="utf-8")) if meta_file.is_file() else {}
    if not archive.is_dir() or not csv_file.is_file():
        print("No bundled historical BFS archive available; using existing/current sources",flush=True)
        return previous
    with csv_file.open(encoding="utf-8-sig",newline="") as f:
        by_bfs={row.get("bfs",""):row.get("WappenURL","")
                for row in csv.DictReader(f)}
    imported=0
    for bfs in sorted(valid_ids,key=int):
        if cached_image(bfs):
            continue
        asset=archive/("thumb_"+bfs+".png")
        source=by_bfs.get(bfs,"")
        # The 2018 dataset explicitly maps filename to the official BFS number
        # and records its original Wikipedia image page per entry.
        if not asset.is_file() or not source.startswith("https://de.wikipedia.org/wiki/"):
            continue
        try:
            with Image.open(asset) as image:
                image.load()
                if image.width<15 or image.height<15:
                    continue
                rendered=image.convert("RGBA")
                rendered.thumbnail((128,128),Image.Resampling.LANCZOS)
                tmp=OUT/(bfs+".png.part")
                rendered.save(tmp,format="PNG",optimize=True)
                tmp.replace(OUT/(bfs+".png"))
                previous[bfs]=source
                imported+=1
        except (OSError,ValueError,UnidentifiedImageError):
            continue
    meta_file.write_text(json.dumps(previous,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(f"Historical BFS archive: {imported} new local coats added, {len(previous)} attributed in total",flush=True)
    return previous

def main():
    source=json.loads(SOURCE.read_text(encoding="utf-8"))
    all_ids=set()
    names={}
    canton_by_bfs={}
    for canton in source["cantons"]:
        for municipality in canton["municipalities"]:
            bfs=str(municipality.get("bfsCode",""))
            if not re.fullmatch(r"[0-9]{1,4}",bfs):
                continue
            all_ids.add(bfs)
            names[bfs]=municipality.get("name",bfs)
            canton_by_bfs[bfs]=canton.get("code","?")
    if len(all_ids)!=2110 or len(source["cantons"])!=26 or NO_COAT_BFS not in all_ids:
        raise SystemExit("Unexpected 2026 BFS register; refusing to invent or misassign coats")
    OUT.mkdir(parents=True,exist_ok=True)
    filenames=wikidata_index(all_ids)
    # Explicitly checked Commons files, never generated from a place name.
    filenames.update(VERIFIED)
    filenames={bfs:file for bfs,file in filenames.items() if bfs in all_ids and bfs!=NO_COAT_BFS}
    expected=all_ids-{NO_COAT_BFS}
    missing_source=expected-filenames.keys()
    print("Source coverage: %s/%s coat-bearing municipalities; no-coat exception: %s" %
          (len(filenames),len(expected),names[NO_COAT_BFS]),flush=True)
    if missing_source:
        print("Missing verified coat source:",[(id,names[id],canton_by_bfs[id]) for id in sorted(missing_source,key=int)],flush=True)
    # This is the online fallback only. A URL alone is never counted as a
    # bundled image, and only offline assets pass the publication gate.
    index={bfs:url_for(filename) for bfs,filename in filenames.items()}
    (OUT/"index.json").write_text(json.dumps(index,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    sources={bfs:"https://commons.wikimedia.org/wiki/File:"+urllib.parse.quote(filename.replace(" ","_"),safe="()_,.-")
             for bfs,filename in filenames.items()}
    (OUT/"sources.json").write_text(json.dumps(sources,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    legacy_sources=import_legacy(expected)
    # Keep the actual historical file provenance separate from current Wikidata
    # online URLs, so the source credit corresponds to the image in the APK.
    for bfs,url in legacy_sources.items():
        if bfs in sources and cached_image(bfs):
            sources[bfs]=url
    (OUT/"sources.json").write_text(json.dumps(sources,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    entries=sorted(filenames.items(),key=lambda x:int(x[0]))
    # Only remaining coats are downloaded. A 2018 archive prevents 2000+
    # throttled Wikimedia requests, and the Actions cache saves new 2026 art.
    entries=[entry for entry in entries if not cached_image(entry[0])]
    print(f"Fresh online coats still needed: {len(entries)}",flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(download_coat,entries))
    successful=sum(results)
    print("Offline coat downloads: %s/%s" % (successful,len(entries)),flush=True)
    logo_ok=download_logo_haute_ajoie()
    print("Haute-Ajoie official municipal logo downloaded: %s" % logo_ok,flush=True)
    present={bfs for bfs in expected if cached_image(bfs)}
    absent=expected-present
    report={
        "register_date":"2026-01-01",
        "municipalities":len(all_ids),
        "coats_expected":len(expected),
        "coats_present":len(present),
        "historical_2018_fallbacks":len([x for x in legacy_sources if x in present]),
        "no_coat_communities":{NO_COAT_BFS:{"name":"Haute-Ajoie","reason":"Gemeindelogo statt eigenem Gemeindewappen","logo_bundled":logo_ok,"source":"https://hauteajoie.ch/"}},
        "source_missing":[{"bfs":id,"name":names[id],"canton":canton_by_bfs[id]} for id in sorted(missing_source,key=int)],
        "asset_missing":[{"bfs":id,"name":names[id],"canton":canton_by_bfs[id]} for id in sorted(absent,key=int)],
    }
    (OUT/"coverage-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("COVERAGE: %s/%s actual offline coat assets; missing: %s" % (len(present),len(expected),len(absent)),flush=True)
    if absent:
        print("FIRST MISSING ASSETS:",[(id,names[id]) for id in sorted(absent,key=int)[:25]],flush=True)
    # Nonzero exit is enforced in the following *separate* CI verification
    # stage so even incomplete runs can save their downloaded assets to cache.

if __name__=="__main__":
    main()
