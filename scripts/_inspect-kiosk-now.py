#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
client = connect_pi(host, user)
try:
    print(run_remote(client, """
echo ---SERVICES---
systemctl is-active planes-api nginx dryl-auth cloudflared-balcony
systemctl --user is-active planes-kiosk.service 2>&1 || true
echo ---API-HEALTH---
curl -sS --max-time 8 http://127.0.0.1:8795/health
echo
echo ---AIRCRAFT-DIRECT---
curl -sS --max-time 20 'http://127.0.0.1:8795/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100' | head -c 1000
echo
echo ---PROCESSES---
ps -eo pid,ppid,%cpu,%mem,etime,args --sort=-%cpu | grep -E 'planes-kiosk|chromium|planes-api' | head -20
echo ---KIOSK-JOURNAL---
journalctl --user -u planes-kiosk.service --since '30 min ago' --no-pager | tail -50
echo ---WATCH-JOURNAL---
journalctl -t planes-kiosk-watch --since '30 min ago' --no-pager | tail -50
echo ---API-JOURNAL---
journalctl -u planes-api.service --since '30 min ago' --no-pager | tail -80
echo ---SCREENSHOT---
XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 grim /tmp/planes-kiosk-now.png 2>&1 || true
ls -l /tmp/planes-kiosk-now.png 2>&1 || true
""", timeout=60))
    sftp = client.open_sftp()
    try:
        sftp.get("/tmp/planes-kiosk-now.png", str(Path(__file__).resolve().parents[1] / "tmp-planes-kiosk-now.png"))
        print("[ok] screenshot downloaded")
    except Exception as error:
        print(f"[screenshot unavailable] {error}")
    finally:
        sftp.close()
finally:
    client.close()
