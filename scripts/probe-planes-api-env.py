#!/usr/bin/env python3
"""Maintain-timer gate: planes-api install must not clobber the Pi .env.

Fails if `scripts/pi-install-planes-api.py` would upload local functions/.env
or let `cp -a STAGING/. REMOTE_ROOT/` replace a pre-existing host .env.

OWNER: errors:probe:refresh / errors:maintain (plane-alert / planes-api-env)
PROVE: python3 scripts/pi-install-planes-api.py --self-test
       npm run verify:kiosk-alert
       npm run verify:planes-api-env
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def main() -> int:
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "pi-install-planes-api.py"), "--self-test"],
        check=False,
    )
    if result.returncode == 0:
        print("OWNER: errors:probe:refresh / errors:maintain planes-api-env")
        print("PROVE: cd plane-alert && npm run verify:planes-api-env")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
