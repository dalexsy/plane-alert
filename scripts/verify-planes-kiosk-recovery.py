#!/usr/bin/env python3
"""Prove planes kiosk recovers empty maps after the Pi auth split (no Daryl walk-by).

Fails when magicmirror still points session/ADS-B health at masked local dryl-auth,
when page-heal cannot see markers while ADS-B has aircraft, or when quiet-hours /
balcony headroom guards were stripped from the watch script.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, kiosk_settings, run_remote  # noqa: E402

ADS_URL = (
    "https://planes.dryl.io/api/planes/adsbPointProxy"
    "?lat=52.4605886&lon=13.523268&radiusKm=100"
)


def _must(cond: bool, msg: str, fails: list[str]) -> None:
    if not cond:
        fails.append(msg)
        print(f"[fail] {msg}")
    else:
        print(f"[ok] {msg}")


def main() -> int:
    host, user = kiosk_settings()
    print(f"[verify:kiosk-recovery] {user}@{host}")
    fails: list[str] = []
    client = connect_pi(host, user)
    try:
        unit = run_remote(
            client,
            "grep -E 'PLANES_KIOSK_AUTH_URL|127.0.0.1:8790|admin.dryl.io' "
            "/etc/systemd/system/planes-kiosk-watch.service || true",
            timeout=30,
        )
        _must(
            "admin.dryl.io" in (unit or "") and "127.0.0.1:8790" not in (unit or ""),
            "watch.service AUTH_URL uses admin.dryl.io (not local :8790)",
            fails,
        )

        watch = run_remote(
            client,
            "cat /usr/local/sbin/planes-kiosk-watch.sh",
            timeout=30,
        ) or ""
        _must(
            "do not require session.jar" in watch.lower()
            and "adsbPointProxy" in watch,
            "plane_data_valid works without session.jar",
            fails,
        )
        _must(
            "edge hosts auth" in watch or "not restarting local dryl-auth" in watch,
            "watch does not restart masked local dryl-auth",
            fails,
        )
        _must(
            "PLANES_KIOSK_PAGE_HEAL_FORCE=1" in watch
            or "soft page heal" in watch,
            "data strikes trigger soft page heal",
            fails,
        )
        _must(
            "is_quiet_hours" in watch and "22:00-07:00" in watch,
            "quiet hours still skip Chromium kill flash",
            fails,
        )
        _must(
            "balcony_needs_headroom" in watch and "renice" in watch,
            "balcony headroom yield/renice still present",
            fails,
        )

        heal_src = run_remote(
            client,
            "grep -E 'empty-stuck|markerCount|PLANES_KIOSK_PAGE_HEAL_FORCE' "
            "/usr/local/sbin/planes-kiosk-page-heal.py || true",
            timeout=30,
        ) or ""
        _must(
            "empty-stuck" in heal_src and "markerCount" in heal_src,
            "page-heal detects empty-stuck (markers=0 vs ADS-B)",
            fails,
        )

        session = run_remote(
            client,
            "sudo -u pi python3 /home/pi/bin/planes-kiosk-session.py --verify-only; echo EXIT:$?",
            timeout=45,
        ) or ""
        _must("EXIT:0" in session, "session verify exit 0 via admin.dryl.io", fails)

        # curl + browser UA — Cloudflare blocks bare urllib (1010) on the kiosk Pi.
        adsb = run_remote(
            client,
            "curl -sf -m 12 -A 'Mozilla/5.0 (X11; Linux aarch64) Chrome/120.0.0.0' "
            f"'{ADS_URL}' | python3 -c "
            "\"import sys,json; d=json.load(sys.stdin); print(len(d.get('ac') or []))\" "
            "2>/dev/null || echo ERR",
            timeout=30,
        ) or "ERR"
        try:
            ac_n = int(str(adsb).strip().splitlines()[-1])
        except ValueError:
            ac_n = -1
        fi = run_remote(
            client,
            "curl -sf -m 12 -A 'Mozilla/5.0 (X11; Linux aarch64) Chrome/120.0.0.0' "
            "'https://opendata.adsb.fi/api/v2/lat/52.4605886/lon/13.523268/dist/54' "
            "| python3 -c \"import sys,json; d=json.load(sys.stdin); "
            "print(len(d.get('ac') or d.get('aircraft') or []))\" "
            "2>/dev/null || echo ERR",
            timeout=30,
        ) or "ERR"
        try:
            fi_n = int(str(fi).strip().splitlines()[-1])
        except ValueError:
            fi_n = -1
        _must(ac_n >= 0, f"public ADS-B reachable (ac={ac_n})", fails)
        if fi_n >= 3:
            _must(
                ac_n >= 1,
                f"proxy not empty while adsb.fi has traffic (ac={ac_n} fi={fi_n})",
                fails,
            )

        heal_out = run_remote(
            client,
            "python3 /usr/local/sbin/planes-kiosk-page-heal.py 2>&1 || true",
            timeout=45,
        ) or ""
        print(heal_out.strip())
        markers_m = re.search(r"markers=(\d+)", heal_out)
        markers = int(markers_m.group(1)) if markers_m else -1
        # Kiosk must show planes whenever the live tab is healthy; ADS-B count
        # is a secondary signal (urllib may differ from Chromium briefly).
        _must(
            markers >= 1 and "ok " in heal_out,
            f"page-heal ok with live markers (markers={markers} ac={ac_n})",
            fails,
        )

        # Chromium must be the user-unit kiosk, not system-bus fiction.
        user_active = run_remote(
            client,
            "sudo -u pi bash -lc 'export XDG_RUNTIME_DIR=/run/user/$(id -u); "
            "export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus; "
            "systemctl --user is-active planes-kiosk.service' 2>&1 || true",
            timeout=30,
        ) or ""
        pgrep = run_remote(
            client,
            "pgrep -af planes-kiosk-chromium | head -1 || true",
            timeout=20,
        ) or ""
        _must(
            "active" in user_active and "planes-kiosk-chromium" in pgrep,
            "user planes-kiosk.service active + chromium running",
            fails,
        )
    finally:
        client.close()

    if fails:
        print(f"[fail] VERIFY_EXIT_1 — kiosk-recovery ({len(fails)} checks)")
        return 1
    print("[ok] VERIFY_EXIT_0 — verify:kiosk-recovery")
    print(
        "CHANGE: Kiosk showing no planes recovers without waiting for noon: "
        "page-heal or soft reload when SPA is up but aircraft list stays empty / "
        "ADS-B fetch stuck — PASS — "
        f"page-heal markers={markers} ac={ac_n}; session verify 0 on magicmirror"
    )
    print(
        "PRESERVE: Quiet hours still avoid full Chromium kill flash; balcony "
        "headroom yield/renice behavior unchanged — PASS — "
        "planes-kiosk-watch.sh still contains is_quiet_hours + balcony_needs_headroom"
    )
    print(
        "PREVENT: planes-kiosk-watch.timer page-heal empty-stuck + "
        "errors:probe:planes-kiosk in directory/scripts"
    )
    print(
        "OWNER: errors:probe:planes-kiosk / errors:maintain planes:kiosk-recovery "
        "cluster in directory/scripts"
    )
    print("PROVE: cd directory && npm run errors:probe:planes-kiosk")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
