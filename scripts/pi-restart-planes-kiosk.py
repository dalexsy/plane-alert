#!/usr/bin/env python3
"""Restart the planes.dryl.io kiosk on magicmirror."""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent / "directory" / "scripts"))

from pi_dryl_common import connect_pi, kiosk_settings, run_remote  # noqa: E402


def main() -> None:
    host, user = kiosk_settings()
    print(f"[planes-kiosk] restarting on {user}@{host}")
    client = connect_pi(host, user)
    try:
        out = run_remote(
            client,
            "/usr/local/sbin/planes-kiosk-restart.sh",
            sudo=True,
            timeout=120,
        )
        print(out.strip())
        print("[ok] planes kiosk restarted")
    finally:
        client.close()


if __name__ == "__main__":
    main()
