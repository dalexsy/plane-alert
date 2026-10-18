#!/usr/bin/env python3
"""Install only the auth watchdog on the kiosk, preserving the running display."""
from pathlib import Path
import hashlib
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'directory' / 'scripts'))
from pi_dryl_common import connect_pi, kiosk_settings

source = Path(__file__).parent / 'mirror-kiosk' / 'kiosk-watchdog.sh'
content = source.read_bytes().replace(b'\r\n', b'\n')
host, user = kiosk_settings()
if host != '192.168.178.74':
    raise SystemExit('Refusing a non-kiosk target')
client = connect_pi(host, user)
try:
    sftp = client.open_sftp()
    with sftp.open('/tmp/kiosk-watchdog-candidate.sh', 'wb') as target:
        target.write(content)
    sftp.close()
    command = r'''set -eu
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
before=$(systemctl --user show planes-kiosk.service -p MainPID --value)
test "$before" -gt 0
bash -n /tmp/kiosk-watchdog-candidate.sh
cp -p /home/pi/kiosk-watchdog.sh /home/pi/kiosk-watchdog.sh.before-20261018
install -m 755 /tmp/kiosk-watchdog-candidate.sh /home/pi/kiosk-watchdog.sh
systemctl --user restart kiosk-watchdog.service
after=$(systemctl --user show planes-kiosk.service -p MainPID --value)
test "$before" = "$after"
systemctl --user is-active kiosk-watchdog.service
sha256sum /home/pi/kiosk-watchdog.sh
printf 'KIOSK_PID_UNCHANGED:%s\n' "$after"
'''
    _, stdout, stderr = client.exec_command(command, timeout=20)
    out, err = stdout.read().decode(), stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    print(out)
    if err:
        print(err, file=sys.stderr)
    if code or hashlib.sha256(content).hexdigest() not in out:
        raise SystemExit('Watchdog install verification failed')
finally:
    client.close()
