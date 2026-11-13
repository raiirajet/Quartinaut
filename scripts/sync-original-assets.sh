#!/usr/bin/env bash
set -euo pipefail
# Downloads only the public, unmodified artwork and municipality snapshot
# already shipped by the deployed Quartinaut web client. No user data.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/app/src/main/assets/q-original"
mkdir -p "$DEST/navigation"
BASE="https://quartinaut.web.app/assets"
get(){
  local relative="$1" output="$2" 
  echo "Syncing official Quartinaut asset: $relative"
  curl --fail --location --silent --show-error --retry 3 --connect-timeout 12     --max-time 45 "$BASE/$relative" -o "$output.tmp"
  test -s "$output.tmp"
  mv "$output.tmp" "$output"
}
get "icons/icon-192.png" "$DEST/icon-192.png"
get "icons/icon-512.png" "$DEST/icon-512.png"
get "icons/quartinaut-logo.svg" "$DEST/quartinaut-logo.svg"
for item in start quartier neu chats profil; do
  get "icons/navigation/$item.png" "$DEST/navigation/$item.png"
done
get "data/ch-locations-2026.json" "$DEST/ch-locations-2026.json"
python3 - "$DEST/ch-locations-2026.json" <<'PY'
import json,sys
data=json.load(open(sys.argv[1],encoding="utf-8"))
cantons=data["cantons"]
assert len(cantons)==26, "Expected 26 cantons"
assert sum(len(c["municipalities"]) for c in cantons)==2110, "Unexpected BFS snapshot"
print("Verified official Quartinaut icon set and 26 cantons / 2110 municipalities")
PY
# Produce the launcher icon from Quartinaut's original PNG.
mkdir -p "$ROOT/app/src/main/res/mipmap-nodpi"
cp "$DEST/icon-512.png" "$ROOT/app/src/main/res/mipmap-nodpi/ic_launcher.png"
