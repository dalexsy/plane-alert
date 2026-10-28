#!/usr/bin/env python3
"""One-shot: prove planes-api on Pi ships quadrant formatter."""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent
REPO = SCRIPT.parent
if str(REPO.parent / "directory" / "scripts") not in sys.path:
    sys.path.insert(0, str(REPO.parent / "directory" / "scripts"))

from pi_dryl_common import connect_pi, run_remote  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent


def _pi():
    scripts = REPO.parent / "directory" / "scripts"
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    from pi_dryl_common import connect_pi as cp, run_remote as rr  # noqa: PLC0415

    pi_install = SCRIPT_DIR / "pi-install-planes-api.py"
    # planes-api prod host/user match pi-install (dryl-prod via manifest helpers).
    import importlib.util

    spec = importlib.util.spec_from_file_location("pi_install_planes_api", pi_install)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    pi = mod._load_pi_common()
    host, user, _ = pi["magicmirror_settings"]()
    return cp, rr, host, user

PATH = (
    "/home/pi/planes-api/node_modules/@plane-alert/shared/dist/cjs/"
    "notification-formatter.js"
)


def main() -> None:
    connect_pi, run_remote, host, user = _pi()
    client = connect_pi(host, user)
    try:
        exists = run_remote(client, f"test -f {PATH} && echo yes || echo no").strip()
        if exists != "yes":
            raise SystemExit(f"[fail] missing {PATH}")
        sym = run_remote(
            client,
            f"grep -c getQuadrantSymbolForBearing {PATH} || true",
        ).strip()
        arrow = run_remote(
            client,
            f"grep -c formatHeadingBound {PATH} || true",
        ).strip()
        sample = run_remote(
            client,
            f"cd /home/pi/planes-api && node -e \"const f=require('./node_modules/@plane-alert/shared/dist/cjs/notification-formatter.js'); console.log(f.formatNotificationBody({{icao:'T',location:'Rudow',direction:'SE',bearing:135,planeHeading:90,altitude:7600,altitudeUnit:'m',verticalRate:800,speedUnit:'km/h'}}));\"",
            timeout=30,
        ).strip()
        print(f"[ok] formatter on Pi: getQuadrantSymbolForBearing hits={sym} formatHeadingBound hits={arrow}")
        print(f"[ok] Pi sample body: {sample}")
        if "◶" not in sample or "⭢" not in sample:
            raise SystemExit("[fail] Pi sample missing quadrant or track arrow glyphs")
        pwa = run_remote(
            client,
            f"cd /home/pi/planes-api && node -e \"const f=require('./node_modules/@plane-alert/shared/dist/cjs/notification-formatter.js'); console.log(f.formatNotificationBody({{icao:'TEST123',callsign:'TESTFLIGHT',direction:'NW',bearing:315,planeHeading:90,altitude:10000,altitudeUnit:'m',speed:500,speedUnit:'km/h',verticalRate:128}}));\"",
            timeout=30,
        ).strip()
        print(f"[ok] Pi PWA test-params body: {pwa}")
        if "◴" not in pwa and "⭦" not in pwa and "NW" not in pwa:
            raise SystemExit("[fail] PWA sample missing NW quadrant/arrow pattern")
        if "⭢" not in pwa:
            raise SystemExit("[fail] PWA sample missing track arrow")
    finally:
        client.close()


if __name__ == "__main__":
    main()
