#!/usr/bin/env python3
"""CI gate: every municipality must have its correct, decodable, offline emblem."""
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"app/src/main/assets/q-original/ch-locations-2026.json"
OUT=ROOT/"app/src/main/assets/wappen"
spec=importlib.util.spec_from_file_location("coat_import",ROOT/"scripts/sync-wappen-assets.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
registry=json.loads(SOURCE.read_text(encoding="utf-8"))
municipalities={str(m["bfsCode"]):(m["name"],c["code"])
                for c in registry["cantons"] for m in c["municipalities"]}
if len(municipalities)!=2110 or len(registry["cantons"])!=26:
    sys.exit("Invalid BFS 2026 registry; expected 2110 municipalities / 26 cantons")
coats=set(municipalities)-{"6809"}
index=json.loads((OUT/"index.json").read_text(encoding="utf-8"))
sources=json.loads((OUT/"sources.json").read_text(encoding="utf-8"))
report=json.loads((OUT/"coverage-report.json").read_text(encoding="utf-8"))
bad=[]
for bfs in sorted(coats,key=int):
    assets=[OUT/(bfs+ext) for ext in (".png",".svg",".jpg",".jpeg",".webp",".gif")]
    valid=[p for p in assets if p.is_file() and module.valid_image(p.read_bytes())]
    if len(valid)!=1:
        bad.append(f"{bfs} {municipalities[bfs][0]} {municipalities[bfs][1]} (assets={len(valid)})")
    if bfs not in index or bfs not in sources:
        bad.append(f"{bfs} missing source attribution")
logo_assets=[OUT/("6809"+ext) for ext in (".png",".svg",".jpg",".jpeg",".webp",".gif")]
logo_valid=any(p.is_file() and module.valid_image(p.read_bytes()) for p in logo_assets)
if not logo_valid:
    bad.append("6809 Haute-Ajoie JU (official municipal logo missing)")
if len(index)!=2109 or len(sources)!=2109:
    bad.append(f"Source manifest mismatch: {len(index)} URLs / {len(sources)} attributions (expected 2109)")
print(f"Swiss municipality emblems verified: {2109-len([x for x in bad if x[:1].isdigit() and not x.startswith('6809')])}/2109 coats; official Haute-Ajoie logo: {logo_valid}")
if bad:
    print(f"FAIL: {len(bad)} issues. First 50:",*bad[:50],sep="\n  ",file=sys.stderr)
    sys.exit(1)
if report["coats_present"]!=2109 or report["coats_expected"]!=2109:
    sys.exit("Report mismatch: not all 2109 coats are present")
print("PASS: all 2110 municipalities have an explicitly sourced locally bundled emblem.")
