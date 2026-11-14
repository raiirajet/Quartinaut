#!/usr/bin/env python3
"""Fetch a small disjoint subset of missing 2026 coats on a separate CI IP.

The main build keeps a persistent BFS-validated asset cache. Downloading
remaining coats on independent runner IPs avoids shared CDN rate limits.
No icon is fabricated and every image retains its Wikidata P94 provenance.
"""
import importlib.util
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.error
import time

ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/"app/src/main/assets/wappen/index.json"
CACHE=ROOT/"app/src/main/assets/wappen"
OUT=ROOT/"tmp/coat-shard"
spec=importlib.util.spec_from_file_location("wappen",ROOT/"scripts/sync-wappen-assets.py")
wappen=importlib.util.module_from_spec(spec)
spec.loader.exec_module(wappen)

def main():
    if len(sys.argv)!=3:
        raise SystemExit("Usage: fetch-wappen-shard.py <shard> <shard_count>")
    shard=int(sys.argv[1]); count=int(sys.argv[2])
    if not 0<=shard<count:
        raise SystemExit("Invalid shard id")
    OUT.mkdir(parents=True,exist_ok=True)
    if not INDEX.is_file():
        print("No source manifest in cache yet, main job will generate it.")
        return
    urls=json.loads(INDEX.read_text(encoding="utf-8"))
    missing=[(bfs,url) for bfs,url in urls.items()
             if bfs.isdecimal() and int(bfs)%count==shard
             and not wappen.cached_image(bfs)]
    print(f"Shard {shard+1}/{count}: {len(missing)} BFS emblems to fetch",flush=True)
    ok=0
    for bfs,original in missing:
        parsed=urllib.parse.urlsplit(original)
        if parsed.scheme!="https" or parsed.hostname!="upload.wikimedia.org":
            continue
        name=urllib.parse.unquote(parsed.path.rsplit("/",1)[-1])
        special="https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(name)
        attempts=[
            original,
            special,
            wappen.proxy_url(original,"wsrv.nl"),
            wappen.proxy_url(original,"images.weserv.nl"),
        ]
        for url in attempts:
            try:
                content=wappen.request(url,timeout=13)
                ext=wappen.valid_image(content)
                if ext:
                    (OUT/(bfs+ext)).write_bytes(content)
                    ok+=1
                    break
            except (OSError,ValueError) as e:
                print(f"Shard {shard}: BFS {bfs} fetch error: {type(e).__name__} {str(e)[:90]}",flush=True)
    print(f"Shard {shard}: {ok}/{len(missing)} saved",flush=True)

if __name__=="__main__":
    main()
