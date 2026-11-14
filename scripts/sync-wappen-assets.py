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
    if not filename.lower().endswith(".svg") or len(filename) > 180 or "/" in filename:
        return None
    return filename

def url_for(filename):
    canonical = filename.replace(" ", "_")
    digest = hashlib.md5(canonical.encode("utf-8")).hexdigest()
    return "https://upload.wikimedia.org/wikipedia/commons/{}/{}/{}".format(
        digest[0], digest[:2], urllib.parse.quote(canonical, safe="()_,.-")
    )

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

def download_svg(entry):
    bfs, filename = entry
    try:
        raw = request(url_for(filename), timeout=15)
        data = raw[:900].lower()
        if not (b"<svg" in data or b"<?xml" in data) or b"<html" in data:
            return False
        if len(raw) > 250_000:
            return False
        destination = OUT / (bfs + ".svg")
        destination.write_bytes(raw)
        return True
    except OSError:
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
    verified = {bfs: url_for(name) for bfs, name in filenames.items() if bfs in all_ids}
    (OUT / "index.json").write_text(
        json.dumps(verified,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )
    # SG is packaged for an immediately usable, offline-first canton map.
    images = [(bfs, filenames[bfs]) for bfs in sorted(sg_ids) if bfs in filenames]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        loaded = sum(bool(ok) for ok in pool.map(download_svg, images))
    print("Wappen index: {} BFS entries; St. Gallen offline SVGs: {}/{}"
          .format(len(verified),loaded,len(images)))
    if loaded == 0:
        print("WARNING: Commons not reachable; live fallback remains available")
    if not (OUT / "index.json").exists():
        raise SystemExit("Wappen manifest was not generated")

if __name__ == "__main__":
    main()
