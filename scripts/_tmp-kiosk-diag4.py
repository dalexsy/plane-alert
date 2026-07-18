#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
# Dump nearby bytes around animationsEnabled from chromium local storage
cmd = r"""python3 - <<'PY'
from pathlib import Path
import re
base = Path('/home/pi/.config/planes-kiosk-chromium/Default/Local Storage/leveldb')
keys = [b'animationsEnabled', b'brightnessAutoMode', b'showGhostPosition', b'militaryMute']
for p in sorted(base.glob('*')):
    if p.suffix not in {'.ldb', '.log'} and p.name not in {'CURRENT','LOCK','LOG','MANIFEST-*'}:
        continue
    try:
        data = p.read_bytes()
    except Exception:
        continue
    for key in keys:
        for m in re.finditer(re.escape(key), data):
            start = max(0, m.start()-20)
            end = min(len(data), m.end()+40)
            chunk = data[start:end]
            printable = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            print(p.name, key.decode(), repr(printable))
PY"""
print(run_remote(c, cmd, sudo=False))
# Audio via wpctl/pipewire
print('==== audio')
print(run_remote(c, "sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 wpctl status 2>&1 | head -40", sudo=False))
print(run_remote(c, "dpkg -l | awk '/speech|espeak|festival/{print}'", sudo=False))
c.close()
