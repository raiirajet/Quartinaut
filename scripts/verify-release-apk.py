#!/usr/bin/env python3
"""Check the APK signature against the pinned, long-lived certificate."""
import os
import re
import subprocess
import sys


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify-release-apk.py APKSIGNER APK")
    expected = os.environ.get("QUARTINAUT_SIGNING_SHA256", "").replace(":", "").lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit("A valid QUARTINAUT_SIGNING_SHA256 fingerprint is required.")
    result = subprocess.run(
        [sys.argv[1], "verify", "--verbose", "--print-certs", sys.argv[2]],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise SystemExit("APK signature verification failed.")
    fingerprints = re.findall(
        r"^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F:]+)$",
        result.stdout, re.MULTILINE,
    )
    if len(fingerprints) != 1 or fingerprints[0].replace(":", "").lower() != expected:
        raise SystemExit("APK signing certificate does not match QUARTINAUT_SIGNING_SHA256.")
    print("APK signature verified against the configured release certificate: " + expected)


if __name__ == "__main__":
    main()
