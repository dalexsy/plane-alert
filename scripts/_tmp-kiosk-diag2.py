#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
cmds = [
    "dpkg -l | grep -E 'espeak|speech-dispatcher|festival' || true",
    "which espeak espeak-ng spd-say 2>/dev/null; ls /usr/share/espeak-ng-data 2>/dev/null | head -3",
    "pactl info 2>/dev/null | head -20 || true",
    "pactl list short sinks 2>/dev/null || true",
    "amixer sget Master 2>/dev/null | head -15 || true",
    # Sample Chromium localStorage for animations via sqlite if present
    "ls -la /home/pi/.config/planes-kiosk-chromium/Default/Local\\ Storage/leveldb 2>/dev/null | head -5",
    "journalctl -t planes-kiosk-watch --since '7 days ago' --no-pager | grep -E 'restart|high renderer|session' | tail -40",
]
for cmd in cmds:
    print("====", cmd[:70])
    try:
        print(run_remote(c, cmd, sudo=False))
    except Exception as e:
        print("ERR", e)
c.close()
