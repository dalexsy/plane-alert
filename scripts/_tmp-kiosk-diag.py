#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
cmds = [
    "journalctl -t planes-kiosk-watch --since '3 hours ago' --no-pager | tail -80",
    "pgrep -af planes-kiosk | head -20",
    "grep -n autoplay /home/pi/bin/planes-kiosk.sh || echo NO_AUTOPLAY",
    "ps -eo args= | grep planes-kiosk-chromium | grep -v grep | grep -v -- --type= | head -3",
    "systemctl --user is-active planes-kiosk.service; systemctl is-active planes-kiosk-watch.timer",
]
for cmd in cmds:
    print("====", cmd)
    try:
        print(run_remote(c, cmd, sudo=False))
    except Exception as e:
        print("ERR", e)
c.close()
