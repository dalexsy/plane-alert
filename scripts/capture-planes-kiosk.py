#!/usr/bin/env python3
"""Capture the physical Magic Mirror Plane Alert kiosk for deploy verification."""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPOS_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(REPOS_ROOT / "directory" / "scripts"))

from pi_dryl_common import connect_pi, kiosk_settings, run_remote  # noqa: E402

REMOTE_PATH = "/tmp/planes-kiosk-verification.png"
LOCAL_PATH = (
    REPOS_ROOT
    / "directory"
    / "logs"
    / "deploy-screenshots"
    / "planes"
    / "kiosk-latest.png"
)


def main() -> None:
    host, user = kiosk_settings()
    client = connect_pi(host, user)
    try:
        result = run_remote(
            client,
            f"""
XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 \
  grim {REMOTE_PATH}
test -s {REMOTE_PATH}
""",
            timeout=30,
        )
        if result.strip():
            print(result.strip())
        LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
        sftp = client.open_sftp()
        try:
            sftp.get(REMOTE_PATH, str(LOCAL_PATH))
        finally:
            sftp.close()
    finally:
        client.close()
    print(f"[agent-required] PLANES_KIOSK_SCREENSHOT: {LOCAL_PATH}")


if __name__ == "__main__":
    main()
