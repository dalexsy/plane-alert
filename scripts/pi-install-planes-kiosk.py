#!/usr/bin/env python3
"""Install planes.dryl.io kiosk scripts + autostart on magicmirror."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
KIOSK_DIR = SCRIPT_DIR / "mirror-kiosk"
sys.path.insert(0, str(SCRIPT_DIR.parent.parent / "directory" / "scripts"))

from pi_dryl_common import connect_pi, magicmirror_settings, run_remote  # noqa: E402

FILES = {
    "planes-kiosk.sh": Path("/home/pi/bin/planes-kiosk.sh"),
    "planes-kiosk-session.py": Path("/home/pi/bin/planes-kiosk-session.py"),
    "planes-kiosk-restart.sh": Path("/usr/local/sbin/planes-kiosk-restart.sh"),
    "planes-kiosk-watch.sh": Path("/usr/local/sbin/planes-kiosk-watch.sh"),
    "kiosk-watchdog.sh": Path("/home/pi/kiosk-watchdog.sh"),
    "kiosk-watchdog.service": Path("/home/pi/.config/systemd/user/kiosk-watchdog.service"),
    "planes-kiosk.desktop": Path("/home/pi/.config/autostart/planes-kiosk.desktop"),
    "planes-kiosk.service": Path("/home/pi/.config/systemd/user/planes-kiosk.service"),
    "planes-kiosk-watch.service": Path("/etc/systemd/system/planes-kiosk-watch.service"),
    "planes-kiosk-watch.timer": Path("/etc/systemd/system/planes-kiosk-watch.timer"),
    "credentials.env.example": Path("/home/pi/.config/planes-kiosk/credentials.env.example"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--launch", action="store_true", help="restart kiosk after install")
    args = parser.parse_args()

    for name in FILES:
        path = KIOSK_DIR / name
        if not path.is_file():
            raise SystemExit(f"Missing {path}")

    host, user, _www = magicmirror_settings()
    gateway = ".".join(host.split(".")[:3]) + ".1"
    print(f"[planes-kiosk] {user}@{host} gateway={gateway}")

    client = connect_pi(host, user)
    try:
        sftp = client.open_sftp()
        for name, remote in FILES.items():
            local = KIOSK_DIR / name
            tmp = f"/tmp/{name}"
            sftp.put(str(local), tmp)
            if name.endswith(".sh") or name.endswith(".py"):
                run_remote(client, f"chmod +x {tmp}", sudo=False)
        sftp.close()

        install_cmds = """
set -euo pipefail
mkdir -p /home/pi/bin /home/pi/.config/autostart /home/pi/.config/systemd/user /home/pi/.config/planes-kiosk
for f in planes-kiosk.sh planes-kiosk-session.py planes-kiosk-restart.sh planes-kiosk-watch.sh kiosk-watchdog.sh; do
  sed -i 's/\\r$//' /tmp/$f
done
install -m 755 /tmp/planes-kiosk.sh /home/pi/bin/planes-kiosk.sh
install -m 755 /tmp/planes-kiosk-session.py /home/pi/bin/planes-kiosk-session.py
sudo install -m 755 /tmp/planes-kiosk-restart.sh /usr/local/sbin/planes-kiosk-restart.sh
sudo install -m 755 /tmp/planes-kiosk-watch.sh /usr/local/sbin/planes-kiosk-watch.sh
# Live path is /home/pi/kiosk-watchdog.sh (user service); keep that path.
install -m 755 /tmp/kiosk-watchdog.sh /home/pi/kiosk-watchdog.sh
install -m 644 /tmp/kiosk-watchdog.service /home/pi/.config/systemd/user/kiosk-watchdog.service
install -m 644 /tmp/planes-kiosk.desktop /home/pi/.config/autostart/planes-kiosk.desktop
install -m 644 /tmp/planes-kiosk.service /home/pi/.config/systemd/user/planes-kiosk.service
install -m 644 /tmp/credentials.env.example /home/pi/.config/planes-kiosk/credentials.env.example
"""
        run_remote(client, install_cmds, sudo=True, timeout=60)

        watch_service = (KIOSK_DIR / "planes-kiosk-watch.service").read_text(encoding="utf-8")
        watch_service = watch_service.replace(
            "PLANES_KIOSK_WATCH_GATEWAY=192.168.178.1",
            f"PLANES_KIOSK_WATCH_GATEWAY={gateway}",
        )
        sftp = client.open_sftp()
        with sftp.file("/tmp/planes-kiosk-watch.service", "w") as handle:
            handle.write(watch_service)
        sftp.put(str(KIOSK_DIR / "planes-kiosk-watch.timer"), "/tmp/planes-kiosk-watch.timer")
        sftp.close()

        finish_cmds = """
set -euo pipefail
sudo cp /tmp/planes-kiosk-watch.service /etc/systemd/system/planes-kiosk-watch.service
sudo cp /tmp/planes-kiosk-watch.timer /etc/systemd/system/planes-kiosk-watch.timer
sudo systemctl daemon-reload
sudo systemctl enable --now planes-kiosk-watch.timer
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user daemon-reload
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable planes-kiosk.service
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable --now kiosk-watchdog.service
systemctl is-active planes-kiosk-watch.timer
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user is-active kiosk-watchdog.service || true
"""
        if args.launch:
            finish_cmds += "\n/usr/local/sbin/planes-kiosk-restart.sh || true\n"
        out = run_remote(client, finish_cmds, sudo=True, timeout=120)
        print(out.strip())
        print("[ok] planes kiosk installed")
    finally:
        client.close()


if __name__ == "__main__":
    main()
