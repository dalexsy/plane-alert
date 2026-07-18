#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
cmds = [
    "dpkg -l espeak-ng speech-dispatcher pulseaudio pipewire-pulse 2>/dev/null | awk '/^ii/{print $2,$3}'",
    "sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 pactl info 2>&1 | head -25",
    "sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 pactl list short sinks 2>&1",
    "sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 pactl get-sink-volume @DEFAULT_SINK@ 2>&1",
    "ls /usr/share/sounds 2>/dev/null | head",
    "strings /home/pi/.config/planes-kiosk-chromium/Default/Local\\ Storage/leveldb/*.ldb /home/pi/.config/planes-kiosk-chromium/Default/Local\\ Storage/leveldb/*.log 2>/dev/null | grep -E 'animationsEnabled|brightnessAuto|kiosk' | head -40",
]
for cmd in cmds:
    print("====", cmd[:90])
    try:
        print(run_remote(c, cmd, sudo=False))
    except Exception as e:
        print("ERR", e)
c.close()
