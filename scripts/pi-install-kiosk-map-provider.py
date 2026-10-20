#!/usr/bin/env python3
"""Install the kiosk-only basemap compatibility fix without reloading Chromium."""
from pathlib import Path
import hashlib
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'directory' / 'scripts'))
from pi_dryl_common import connect_pi, kiosk_settings

root = Path(__file__).parent / 'mirror-kiosk'
names = ['planes-kiosk-page-heal.py', 'planes_kiosk_map_provider.py', 'planes-kiosk-night-basemap.js']
host, user = kiosk_settings()
if host != '192.168.178.74':
    raise SystemExit('Refusing a non-kiosk target')
client = connect_pi(host, user)
try:
    _, stdout, _ = client.exec_command('mktemp -d /tmp/planes-map-provider.XXXXXX')
    temporary = stdout.read().decode().strip()
    if not temporary.startswith('/tmp/planes-map-provider.'):
        raise SystemExit('Temporary install directory unavailable')
    hashes = {}
    sftp = client.open_sftp()
    for name in names:
        content = (root / name).read_bytes().replace(b'\r\n', b'\n')
        hashes[name] = hashlib.sha256(content).hexdigest()
        with sftp.open(f'{temporary}/{name}', 'wb') as target:
            target.write(content)
    sftp.close()
    command = 'set -eu\n' + f'cd {temporary}\n' + r'''
export XDG_RUNTIME_DIR=/run/user/$(id -u)
before=$(systemctl --user show planes-kiosk.service -p MainPID --value)
test "$before" -gt 0
python3 -m py_compile planes-kiosk-page-heal.py planes_kiosk_map_provider.py
if [ ! -f /usr/local/sbin/planes-kiosk-page-heal.py.before-20261018 ]; then
  sudo -n cp -p /usr/local/sbin/planes-kiosk-page-heal.py /usr/local/sbin/planes-kiosk-page-heal.py.before-20261018
fi
sudo -n install -m 755 planes-kiosk-page-heal.py /usr/local/sbin/planes-kiosk-page-heal.py
sudo -n install -m 644 planes_kiosk_map_provider.py planes-kiosk-night-basemap.js /usr/local/sbin/
python3 - <<'PY'
import sys, runpy, json, urllib.request, websocket
sys.path.insert(0, '/usr/local/sbin')
from planes_kiosk_map_provider import apply_night_basemap
heal = runpy.run_path('/usr/local/sbin/planes-kiosk-page-heal.py')
page = next(p for p in json.load(urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5)) if p.get('type') == 'page' and 'planes.dryl.io' in p.get('url', ''))
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=10)
try:
    before = heal['_evaluate'](ws, '({timeOrigin:performance.timeOrigin})')
    heal['_evaluate'](ws, '(() => { window.__kioskProviderPreview?.restore(); return {}; })()')
    print(json.dumps(apply_night_basemap(heal['_evaluate'], ws)))
    after = heal['_evaluate'](ws, '({timeOrigin:performance.timeOrigin})')
    if before != after:
        raise RuntimeError('Unexpected document navigation')
    print('DOCUMENT_UNCHANGED:' + str(after['timeOrigin']))
finally:
    ws.close()
PY
after=$(systemctl --user show planes-kiosk.service -p MainPID --value)
test "$before" = "$after"
printf 'KIOSK_PID_UNCHANGED:%s\n' "$after"
sha256sum /usr/local/sbin/planes-kiosk-page-heal.py /usr/local/sbin/planes_kiosk_map_provider.py /usr/local/sbin/planes-kiosk-night-basemap.js
'''
    _, stdout, stderr = client.exec_command(command, timeout=45)
    out, err = stdout.read().decode(), stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    print(out)
    if err:
        print(err, file=sys.stderr)
    if code or not all(value in out for value in hashes.values()):
        raise SystemExit('Kiosk provider installation verification failed')
finally:
    if 'temporary' in locals() and temporary.startswith('/tmp/planes-map-provider.'):
        sftp = client.open_sftp()
        try:
            cache = temporary + '/__pycache__'
            for name in sftp.listdir(cache):
                sftp.remove(cache + '/' + name)
            sftp.rmdir(cache)
            for name in names:
                sftp.remove(temporary + '/' + name)
            sftp.rmdir(temporary)
        finally:
            sftp.close()
    client.close()
