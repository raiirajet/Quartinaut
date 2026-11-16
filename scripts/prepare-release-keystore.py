#!/usr/bin/env python3
"""Decode a CI secret into a private temporary keystore without logging it."""
import base64
import binascii
import os
from pathlib import Path


def main():
    names = (
        "QUARTINAUT_KEYSTORE_BASE64",
        "QUARTINAUT_KEYSTORE_PASSWORD",
        "QUARTINAUT_KEY_ALIAS",
        "QUARTINAUT_KEY_PASSWORD",
        "QUARTINAUT_SIGNING_SHA256",
    )
    missing = [name for name in names if not os.environ.get(name, "").strip()]
    if missing:
        raise SystemExit("Signing configuration missing: " + ", ".join(missing))
    try:
        raw = base64.b64decode(os.environ[names[0]], validate=True)
    except (ValueError, binascii.Error):
        raise SystemExit("QUARTINAUT_KEYSTORE_BASE64 is not valid base64.") from None
    if not raw or len(raw) > 1_048_576:
        raise SystemExit("Keystore is empty or exceeds 1 MiB.")
    fingerprint = os.environ["QUARTINAUT_SIGNING_SHA256"].replace(":", "").lower()
    if len(fingerprint) != 64 or any(c not in "0123456789abcdef" for c in fingerprint):
        raise SystemExit("QUARTINAUT_SIGNING_SHA256 must be the certificate SHA-256 fingerprint.")
    target = Path(os.environ["QUARTINAUT_KEYSTORE_FILE"])
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(raw)
    print("Private release keystore prepared.")


if __name__ == "__main__":
    main()
