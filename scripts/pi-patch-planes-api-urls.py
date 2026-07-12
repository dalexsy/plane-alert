#!/usr/bin/env python3
"""One-time patch live planes bundle to use Pi /api/planes/ instead of Cloud Functions."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

BASE = "/var/www/dryl/planes"
REPLACEMENTS = [
    (
        "https://europe-west3-plane-alert-800ff.cloudfunctions.net/registerDevice",
        "/api/planes/registerDevice",
    ),
    (
        "https://europe-west3-plane-alert-800ff.cloudfunctions.net/checkDevice",
        "/api/planes/checkDevice",
    ),
    (
        "https://europe-west3-plane-alert-800ff.cloudfunctions.net/adsbPointProxy",
        "/api/planes/adsbPointProxy",
    ),
]


def main() -> None:
    host, user, _ = magicmirror_settings()
    client = connect_pi(host, user)
    for old, new in REPLACEMENTS:
        old_q = old.replace("/", "\\/")
        new_q = new.replace("/", "\\/")
        run_remote(
            client,
            f"grep -rl '{old}' {BASE} | xargs -r sudo sed -i 's/{old_q}/{new_q}/g'",
            timeout=120,
            sudo=True,
        )
    out = run_remote(
        client,
        f"grep -rl '/api/planes/registerDevice' {BASE} | head -1",
        timeout=60,
    ).strip()
    print(f"[ok] patched bundle: {out or '(none found)'}")
    client.close()


if __name__ == "__main__":
    main()
