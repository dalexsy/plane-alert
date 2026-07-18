#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
cmd = r"""python3 - <<'PY'
from pathlib import Path
import re
base = Path('/home/pi/.config/planes-kiosk-chromium/Default/Local Storage/leveldb')
# Prefer newest log first (live writes), then ldb
files = sorted(base.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
files += sorted(base.glob('*.ldb'), key=lambda p: p.stat().st_mtime, reverse=True)
keys = [b'animationsEnabled', b'brightnessAutoMode']
for p in files:
    data = p.read_bytes()
    for key in keys:
        idxs = [m.start() for m in re.finditer(re.escape(key), data)]
        print(f'--- {p.name} mtime={p.stat().st_mtime:.0f} key={key.decode()} hits={len(idxs)}')
        for i in idxs[-3:]:
            chunk = data[i:i+len(key)+30]
            printable = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            # Also search for true/false near key
            near = data[max(0,i-5):i+len(key)+25]
            tf = b'true' in near or b'false' in near
            print(' ', printable, 'has_tf', tf, 'true' if b'true' in near else '', 'false' if b'false' in near else '')
PY"""
print(run_remote(c, cmd, sudo=False))
c.close()
