#!/usr/bin/env python3
"""Create a BFS-verified, offline-friendly Swiss coat-of-arms cache at build time.

This script only uses Wikimedia Commons material explicitly linked by Wikidata
P771 (official BFS municipality identifier) and P94 (coat of arms image).
Never invent an image from a municipality name. The app continues to work
without external services if Wikidata or Commons temporarily fails.
"""
import concurrent.futures
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
VERIFIED = {"3401": "CHE Degersheim COA.svg", "3402": "CHE Flawil COA.svg"}

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

def download_coat(entry):
    bfs, filename, image = entry
    extension = Path(filename).suffix.lower()
    # A tiny PNG thumbnail is preferred over an arbitrary large SVG original.
    urls = list(dict.fromkeys([image, url_for(filename), file_page_for(filename)]))
    for url in urls:
        try:
            raw = request(url, timeout=6)
            if len(raw)>150_000: continue
            header = raw[:8192].lower()
            if raw.startswith(b"\x89PNG"):
                final_ext = ".png"
            elif raw.startswith(b"\xff\xd8"):
                final_ext = ".jpg"
            elif raw.startswith(b"RIFF") and b"WEBP" in raw[:16]:
                final_ext = ".webp"
            elif b"<svg" in header and b"<html" not in header:
                final_ext = ".svg"
            elif raw.startswith(b"GIF8"):
                final_ext = ".gif"
            else:
                continue
            (OUT / (bfs + final_ext)).write_bytes(raw)
            return True
        except OSError:
            continue
    return False

def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    cantons = source["cantons"]
    all_ids = set()
    sg_ids = set()
    for canton in cantons:
        for municipality in canton["municipalities"]:
            bfs = str(municipality.get("bfsCode", ""))
            if not re.fullmatch(r"[0-9]{1,4}", bfs):
                continue
            all_ids.add(bfs)
            if canton.get("code") == "SG":
                sg_ids.add(bfs)
    if len(all_ids) != 2110 or len(sg_ids) < 65:
        raise SystemExit("Unexpected municipal register; refusing guessed lookup")
    OUT.mkdir(parents=True, exist_ok=True)
    filenames = dict(VERIFIED)
    filenames.update(wikidata_index(all_ids))
    # Cover all 26 cantons: raster arms are kept alongside SVG arms.
    thumbnails = thumbnail_index(filenames)
    verified = {
        bfs: thumbnails.get(bfs, file_page_for(name))
        for bfs, name in filenames.items() if bfs in all_ids
    }
    (OUT / "index.json").write_text(
        json.dumps(verified,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )
    provenance = {
        bfs: "https://commons.wikimedia.org/wiki/File:" +
             urllib.parse.quote(filename.replace(" ", "_"), safe="()_,.-")
        for bfs,filename in filenames.items() if bfs in all_ids
    }
    (OUT / "sources.json").write_text(
        json.dumps(provenance,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )
    # Download all 26 cantons with a fixed build-time budget. Every remaining
    # entry has a verified online URL and is cached by Coil after first use.
    images = [(bfs, name, verified[bfs]) for bfs,name in sorted(filenames.items())
              if bfs in all_ids]
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=24)
    futures = [pool.submit(download_coat,entry) for entry in images]
    done,pending = concurrent.futures.wait(futures,timeout=160)
    loaded = sum(bool(f.result()) for f in done if not f.exception())
    for future in pending:future.cancel()
    pool.shutdown(wait=False,cancel_futures=True)
    bytype={ext:sum(Path(name).suffix.lower()==ext for name in filenames.values())
            for ext in (".svg",".png",".jpg",".jpeg",".webp",".gif")}
    offline_files = list(OUT.glob("*.png"))+list(OUT.glob("*.svg"))+list(OUT.glob("*.jpg"))+list(OUT.glob("*.webp"))+list(OUT.glob("*.gif"))
    offline_bfs={p.stem for p in offline_files}
    sg_ready=len(sg_ids.intersection(offline_bfs))
    print("Wappen index: {}/{} BFS entries; image formats: {}".format(
        len(verified),len(all_ids),bytype))
    print("Offline wappen: {}/{} across 26 cantons; SG: {}/{}".format(
        len(offline_bfs),len(verified),sg_ready,len(sg_ids)))
    if not offline_bfs:
        print("WARNING: Commons did not return any packaged images; online fallback remains")
    if not (OUT / "index.json").exists():
        raise SystemExit("Wappen manifest was not generated")

if __name__ == "__main__":
    main()
