#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, load_manifest, run_remote, pi_settings

manifest = load_manifest()
host, user, _ = pi_settings(manifest)
client = connect_pi(host, user)
cmds = [
    "ls -la /var/www/dryl/planes/main-*.js",
    r"grep -o 'main-[A-Z0-9]*\.js' /var/www/dryl/planes/index.html",
    "find /var/www/dryl/planes -name 'main-*.js' | wc -l",
    r"grep -c 'ensureFreshShell\|planes-shell-reload' /var/www/dryl/planes/main-*.js || true",
    "curl -sI -H 'Host: planes.dryl.io' http://127.0.0.1/ | head -20",
    "curl -sI -H 'Host: planes.dryl.io' http://127.0.0.1/index.html | head -20",
    "ls -la /home/pi/.config/planes-kiosk-chromium/Default/ 2>/dev/null | head -8 || echo no-kiosk-profile",
]
for cmd in cmds:
    print("===", cmd)
    print(run_remote(client, cmd).strip())
client.close()