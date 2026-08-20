#!/usr/bin/env python3
"""Install planes.dryl.io kiosk scripts + autostart on magicmirror (.74).

Do not enable leftover planes-api.service on this host — API is dryl-prod
(.79) only. Audio-local is planes-kiosk-alert.service (pw-play → Jabra).

UFW: persist 8796/tcp ALLOW IN from Ethernet dryl-prod only. INPUT DROP
otherwise blocks prod POSTs and silences chimes. Never allow 8796 from
Anywhere / 0.0.0.0/0. Do not SSH via the directory helper that aliases
magicmirror to prod — kiosk install is kiosk_settings() (.74) only.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
KIOSK_DIR = SCRIPT_DIR / "mirror-kiosk"
DIRECTORY_SCRIPTS = SCRIPT_DIR.parent.parent / "directory" / "scripts"

FILES = {
    "planes-kiosk.sh": Path("/home/pi/bin/planes-kiosk.sh"),
    "planes-kiosk-session.py": Path("/home/pi/bin/planes-kiosk-session.py"),
    "planes-kiosk-page-heal.py": Path("/usr/local/sbin/planes-kiosk-page-heal.py"),
    "planes-kiosk-restart.sh": Path("/usr/local/sbin/planes-kiosk-restart.sh"),
    "planes-kiosk-watch.sh": Path("/usr/local/sbin/planes-kiosk-watch.sh"),
    "planes-kiosk-alert-listen.py": Path("/home/pi/bin/planes-kiosk-alert-listen.py"),
    "planes-kiosk-alert-play.sh": Path("/home/pi/bin/planes-kiosk-alert-play.sh"),
    "kiosk-watchdog.sh": Path("/home/pi/kiosk-watchdog.sh"),
    "kiosk-watchdog.service": Path("/home/pi/.config/systemd/user/kiosk-watchdog.service"),
    "planes-kiosk.desktop": Path("/home/pi/.config/autostart/planes-kiosk.desktop"),
    "planes-kiosk.service": Path("/home/pi/.config/systemd/user/planes-kiosk.service"),
    "planes-kiosk-alert.service": Path("/home/pi/.config/systemd/user/planes-kiosk-alert.service"),
    "planes-kiosk-watch.service": Path("/etc/systemd/system/planes-kiosk-watch.service"),
    "planes-kiosk-watch.timer": Path("/etc/systemd/system/planes-kiosk-watch.timer"),
    "credentials.env.example": Path("/home/pi/.config/planes-kiosk/credentials.env.example"),
    "alert-play.env.example": Path("/home/pi/.config/planes-kiosk/alert-play.env.example"),
}

ALERT_MP3S = (
    "precious_little_life_forms.mp3",
    "hercules.mp3",
    "iago.mp3",
)

ALERT_LISTEN_PORT = 8796
# Ethernet dryl-prod. Not magicmirror (.74). Not 0.0.0.0/0.
KNOWN_DRYL_PROD_IP = "192.168.178.79"
UFW_ALERT_COMMENT = "planes-kiosk-alert from dryl-prod"
_UFW_NUM = re.compile(r"^\[\s*(\d+)\s*\]\s*(.+)$")
_WIDE_SOURCE = re.compile(r"\bAnywhere\b|0\.0\.0\.0/0|::/0", re.I)
_IPV4 = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")


def _is_ipv4(value: str) -> bool:
    if not _IPV4.match(value):
        return False
    return all(0 <= int(part) <= 255 for part in value.split("."))


def _usable_prod_ip(host: str) -> bool:
    """Reject wildcards, loopback, and the leftover kiosk host (.74)."""
    if not _is_ipv4(host):
        return False
    if host in {"0.0.0.0", "127.0.0.1"}:
        return False
    return not host.endswith(".74")


def resolve_dryl_prod_ip(prod_settings: Callable[[], Any] | None = None) -> str:
    """Ethernet dryl-prod IPv4. Prefer directory prod_settings; else known .79.

    Do not look up the kiosk host from the prod-aliased magicmirror helper.
    """
    getter = prod_settings
    if getter is None:
        try:
            from pi_dryl_common import prod_settings as getter  # noqa: PLC0415
        except ImportError:
            getter = None
    if getter is not None:
        try:
            raw = getter()
        except Exception:
            raw = None
        host = ""
        if isinstance(raw, (tuple, list)) and raw:
            host = str(raw[0]).strip()
        elif raw is not None:
            host = str(raw).strip()
        if _usable_prod_ip(host):
            return host
    return KNOWN_DRYL_PROD_IP


def parse_ufw_numbered(status: str) -> list[tuple[int, str]]:
    rules: list[tuple[int, str]] = []
    for raw in status.splitlines():
        match = _UFW_NUM.match(raw.strip())
        if match:
            rules.append((int(match.group(1)), match.group(2).strip()))
    return rules


def is_alert_port_rule(body: str, port: int = ALERT_LISTEN_PORT) -> bool:
    return bool(re.match(rf"{port}(/tcp)?\b", body.strip()))


def is_wide_ufw_source(body: str) -> bool:
    return bool(_WIDE_SOURCE.search(body))


def is_prod_ufw_source(body: str, prod_ip: str) -> bool:
    if is_wide_ufw_source(body):
        return False
    return bool(re.search(rf"(?<![0-9]){re.escape(prod_ip)}(?![0-9])", body))


def plan_ufw_alert_rules(
    status: str,
    prod_ip: str,
    port: int = ALERT_LISTEN_PORT,
) -> tuple[list[int], bool]:
    """Return (rule numbers to delete high→low, whether to add the .79 rule)."""
    delete: list[int] = []
    have_prod = False
    for num, body in parse_ufw_numbered(status):
        if not is_alert_port_rule(body, port):
            continue
        if "ALLOW" not in body.upper():
            continue
        if is_prod_ufw_source(body, prod_ip):
            have_prod = True
            continue
        delete.append(num)
    delete.sort(reverse=True)
    return delete, not have_prod


def ufw_allow_alert_cmd(prod_ip: str, port: int = ALERT_LISTEN_PORT) -> str:
    if not _usable_prod_ip(prod_ip):
        raise ValueError(f"refusing non-prod ufw source {prod_ip!r}")
    return (
        f"ufw allow from {prod_ip} to any port {port} proto tcp "
        f"comment '{UFW_ALERT_COMMENT}'"
    )


def ufw_remote_commands(
    deletes: list[int],
    need_add: bool,
    prod_ip: str,
) -> list[str]:
    cmds = [f"printf 'y\\n' | sudo ufw delete {num}" for num in deletes]
    if need_add:
        cmds.append(f"sudo {ufw_allow_alert_cmd(prod_ip)}")
    return cmds


def assert_ufw_alert_locked(
    status: str,
    prod_ip: str,
    port: int = ALERT_LISTEN_PORT,
) -> None:
    deletes, need_add = plan_ufw_alert_rules(status, prod_ip, port)
    if deletes or need_add:
        raise SystemExit(
            f"[fail] ufw {port} is not locked to {prod_ip} only\n{status}"
        )


def apply_kiosk_alert_ufw(
    run: Callable[[str], str],
    prod_ip: str,
) -> str:
    """Idempotent: 8796/tcp from prod_ip only. Deletes Anywhere / 0.0.0.0/0."""
    status = run("sudo ufw status numbered || true")
    cmds = ufw_remote_commands(*plan_ufw_alert_rules(status, prod_ip), prod_ip)
    chunks = [status]
    if cmds:
        chunks.append(run("set -euo pipefail\n" + "\n".join(cmds)))
    verify = run("sudo ufw status numbered || true")
    chunks.append(verify)
    if re.search(r"Status:\s*inactive", verify, re.I):
        added = run("sudo ufw show added || true")
        chunks.append(added)
        allow = ufw_allow_alert_cmd(prod_ip)
        if f"from {prod_ip} to any port {ALERT_LISTEN_PORT}" not in added:
            raise SystemExit(
                f"[fail] ufw inactive and {allow} not recorded\n{added}"
            )
        if is_wide_ufw_source(added) and str(ALERT_LISTEN_PORT) in added:
            wide_lines = [
                line
                for line in added.splitlines()
                if str(ALERT_LISTEN_PORT) in line and is_wide_ufw_source(line)
            ]
            if wide_lines:
                raise SystemExit(
                    "[fail] 8796 must not be allowed from Anywhere / 0.0.0.0/0\n"
                    + "\n".join(wide_lines)
                )
        return "\n".join(chunks)
    assert_ufw_alert_locked(verify, prod_ip)
    return "\n".join(chunks)


def self_test() -> None:
    live = (
        "[21] 8796/tcp ALLOW IN 192.168.178.79 "
        "# planes-kiosk-alert from dryl-prod"
    )
    assert plan_ufw_alert_rules(live, KNOWN_DRYL_PROD_IP) == ([], False)

    wide = (
        "[ 8] 8796/tcp ALLOW IN Anywhere\n"
        "[ 9] 8796/tcp ALLOW IN Anywhere (v6)\n"
    )
    assert plan_ufw_alert_rules(wide, KNOWN_DRYL_PROD_IP) == ([9, 8], True)

    both = (
        "[21] 8796/tcp ALLOW IN 192.168.178.79 "
        "# planes-kiosk-alert from dryl-prod\n"
        "[22] 8796/tcp ALLOW IN Anywhere\n"
    )
    assert plan_ufw_alert_rules(both, KNOWN_DRYL_PROD_IP) == ([22], False)

    assert plan_ufw_alert_rules("Status: inactive\n", KNOWN_DRYL_PROD_IP) == (
        [],
        True,
    )
    assert plan_ufw_alert_rules(
        "[5] 8796/tcp ALLOW IN 192.168.178.1\n",
        KNOWN_DRYL_PROD_IP,
    ) == ([5], True)

    other = "[3] 22/tcp ALLOW IN Anywhere\n[4] 8795/tcp ALLOW IN Anywhere\n"
    assert plan_ufw_alert_rules(other, KNOWN_DRYL_PROD_IP) == ([], True)

    cmd = ufw_allow_alert_cmd(KNOWN_DRYL_PROD_IP)
    assert cmd == (
        "ufw allow from 192.168.178.79 to any port 8796 proto tcp "
        "comment 'planes-kiosk-alert from dryl-prod'"
    )
    assert "0.0.0.0/0" not in cmd
    assert "Anywhere" not in cmd
    try:
        ufw_allow_alert_cmd("0.0.0.0")
        raise AssertionError("must refuse wildcard source")
    except ValueError:
        pass
    try:
        ufw_allow_alert_cmd("192.168.178.74")
        raise AssertionError("must refuse kiosk host as source")
    except ValueError:
        pass

    def _boom() -> None:
        raise RuntimeError("directory helper unavailable")

    assert resolve_dryl_prod_ip(_boom) == KNOWN_DRYL_PROD_IP
    assert resolve_dryl_prod_ip(lambda: ("dryl-prod", "pi")) == KNOWN_DRYL_PROD_IP
    assert resolve_dryl_prod_ip(lambda: ("192.168.178.79", "pi")) == (
        KNOWN_DRYL_PROD_IP
    )
    assert resolve_dryl_prod_ip(lambda: ("0.0.0.0", "pi")) == KNOWN_DRYL_PROD_IP
    assert resolve_dryl_prod_ip(lambda: ("192.168.178.74", "pi")) == (
        KNOWN_DRYL_PROD_IP
    )
    assert resolve_dryl_prod_ip() == KNOWN_DRYL_PROD_IP

    class _FakeRun:
        def __init__(self, first: str, second: str) -> None:
            self.cmds: list[str] = []
            self.first = first
            self.second = second
            self.n = 0

        def __call__(self, cmd: str) -> str:
            self.cmds.append(cmd)
            if "status numbered" in cmd:
                self.n += 1
                return self.first if self.n == 1 else self.second
            return "ok"

    rerun = _FakeRun(live, live)
    apply_kiosk_alert_ufw(rerun, KNOWN_DRYL_PROD_IP)
    assert not any("ufw allow" in item for item in rerun.cmds)
    assert not any("ufw delete" in item for item in rerun.cmds)

    locked = (
        "[21] 8796/tcp ALLOW IN 192.168.178.79 "
        "# planes-kiosk-alert from dryl-prod\n"
    )
    replace = _FakeRun(wide, locked)
    apply_kiosk_alert_ufw(replace, KNOWN_DRYL_PROD_IP)
    joined = "\n".join(replace.cmds)
    assert "sudo ufw delete 9" in joined
    assert "sudo ufw delete 8" in joined
    assert (
        "sudo ufw allow from 192.168.178.79 to any port 8796 proto tcp "
        "comment 'planes-kiosk-alert from dryl-prod'"
    ) in joined
    allow_lines = [item for item in replace.cmds if "ufw allow" in item]
    assert allow_lines
    assert "0.0.0.0/0" not in allow_lines[0]
    assert "Anywhere" not in allow_lines[0]
    assert "8795" not in joined
    assert "22/tcp" not in joined

    src = Path(__file__).read_text(encoding="utf-8")
    assert not re.search(r"magicmirror_settings\s*\(", src)
    assert "systemctl disable --now planes-api.service" in src
    assert ("systemctl enable" + " planes-api") not in src
    assert ("systemctl enable --now" + " planes-api") not in src
    assert ("ufw allow" + " 8796") not in src
    assert ("POST " + "/play") not in src
    print("[ok] planes kiosk ufw persist self-test")


def _load_pi_common() -> dict[str, Any]:
    if str(DIRECTORY_SCRIPTS) not in sys.path:
        sys.path.insert(0, str(DIRECTORY_SCRIPTS))
    from pi_dryl_common import connect_pi, kiosk_settings, run_remote  # noqa: PLC0415

    extras: dict[str, Any] = {"prod_settings": None}
    try:
        from pi_dryl_common import prod_settings  # noqa: PLC0415

        extras["prod_settings"] = prod_settings
    except ImportError:
        pass
    return {
        "connect_pi": connect_pi,
        "kiosk_settings": kiosk_settings,
        "run_remote": run_remote,
        **extras,
    }


def main() -> None:
    if "--self-test" in sys.argv:
        self_test()
        return

    parser = argparse.ArgumentParser()
    parser.add_argument("--launch", action="store_true", help="restart kiosk after install")
    args = parser.parse_args()

    for name in FILES:
        path = KIOSK_DIR / name
        if not path.is_file():
            raise SystemExit(f"Missing {path}")

    pi = _load_pi_common()
    connect_pi = pi["connect_pi"]
    kiosk_settings = pi["kiosk_settings"]
    run_remote = pi["run_remote"]
    prod_ip = resolve_dryl_prod_ip(pi.get("prod_settings"))

    host, user = kiosk_settings()
    gateway = ".".join(host.split(".")[:3]) + ".1"
    print(f"[planes-kiosk] {user}@{host} gateway={gateway} prod={prod_ip}")

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

        alerts_src = SCRIPT_DIR.parent / "src" / "assets" / "alerts"
        run_remote(client, "mkdir -p /tmp/kiosk-alerts /home/pi/.config/planes-kiosk/alerts")
        sftp = client.open_sftp()
        for name in ALERT_MP3S:
            local = alerts_src / name
            if local.is_file():
                sftp.put(str(local), f"/tmp/kiosk-alerts/{name}")
            else:
                print(f"[warn] missing kiosk alert mp3: {local}")
        sftp.close()

        install_cmds = """
set -euo pipefail
mkdir -p /home/pi/bin /home/pi/.config/autostart /home/pi/.config/systemd/user /home/pi/.config/planes-kiosk/alerts
for f in planes-kiosk.sh planes-kiosk-session.py planes-kiosk-page-heal.py planes-kiosk-restart.sh planes-kiosk-watch.sh planes-kiosk-alert-listen.py planes-kiosk-alert-play.sh kiosk-watchdog.sh; do
  sed -i 's/\\r$//' /tmp/$f
done
install -m 755 /tmp/planes-kiosk.sh /home/pi/bin/planes-kiosk.sh
install -m 755 /tmp/planes-kiosk-session.py /home/pi/bin/planes-kiosk-session.py
install -m 755 /tmp/planes-kiosk-alert-listen.py /home/pi/bin/planes-kiosk-alert-listen.py
install -m 755 /tmp/planes-kiosk-alert-play.sh /home/pi/bin/planes-kiosk-alert-play.sh
sudo install -m 755 /tmp/planes-kiosk-page-heal.py /usr/local/sbin/planes-kiosk-page-heal.py
sudo install -m 755 /tmp/planes-kiosk-restart.sh /usr/local/sbin/planes-kiosk-restart.sh
sudo install -m 755 /tmp/planes-kiosk-watch.sh /usr/local/sbin/planes-kiosk-watch.sh
# Live path is /home/pi/kiosk-watchdog.sh (user service); keep that path.
install -m 755 /tmp/kiosk-watchdog.sh /home/pi/kiosk-watchdog.sh
install -m 644 /tmp/kiosk-watchdog.service /home/pi/.config/systemd/user/kiosk-watchdog.service
install -m 644 /tmp/planes-kiosk.desktop /home/pi/.config/autostart/planes-kiosk.desktop
install -m 644 /tmp/planes-kiosk.service /home/pi/.config/systemd/user/planes-kiosk.service
install -m 644 /tmp/planes-kiosk-alert.service /home/pi/.config/systemd/user/planes-kiosk-alert.service
install -m 644 /tmp/credentials.env.example /home/pi/.config/planes-kiosk/credentials.env.example
install -m 644 /tmp/alert-play.env.example /home/pi/.config/planes-kiosk/alert-play.env.example
if [ -d /tmp/kiosk-alerts ]; then
  install -m 644 /tmp/kiosk-alerts/*.mp3 /home/pi/.config/planes-kiosk/alerts/ || true
fi
if [ ! -f /home/pi/.config/planes-kiosk/alert-play.env ]; then
  python3 - <<'PY'
import secrets
from pathlib import Path
p = Path("/home/pi/.config/planes-kiosk/alert-play.env")
p.write_text(
    "PLANES_KIOSK_PLAY_TOKEN=" + secrets.token_hex(24) + "\\n"
    "PLANES_KIOSK_ALERT_LISTEN_PORT=8796\\n"
    "PLANES_KIOSK_ALERTS_DIR=/home/pi/planes-api/assets/alerts\\n"
    "PLANES_KIOSK_PWPLAY_VOLUME=0.7\\n"
)
p.chmod(0o600)
print("ALERT_PLAY_ENV_CREATED")
PY
fi
chown -R pi:pi /home/pi/.config/planes-kiosk /home/pi/bin/planes-kiosk-alert-listen.py /home/pi/bin/planes-kiosk-alert-play.sh /home/pi/.config/systemd/user/planes-kiosk-alert.service
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
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable --now planes-kiosk-alert.service
systemctl is-active planes-kiosk-watch.timer
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user is-active kiosk-watchdog.service || true
sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user is-active planes-kiosk-alert.service || true
python3 /home/pi/bin/planes-kiosk-alert-listen.py --self-test
/home/pi/bin/planes-kiosk-alert-play.sh --self-test || true
# Leftover API unit on .74 stays disabled — do not re-enable.
sudo systemctl disable --now planes-api.service >/dev/null 2>&1 || true
echo "[kiosk-alert] leftover planes-api.service on .74 left disabled"
echo "[kiosk-alert] copy PLANES_KIOSK_PLAY_TOKEN from /home/pi/.config/planes-kiosk/alert-play.env to dryl-prod planes-api .env"
"""
        if args.launch:
            finish_cmds += "\n/usr/local/sbin/planes-kiosk-restart.sh || true\n"
        out = run_remote(client, finish_cmds, sudo=True, timeout=120)
        print(out.strip())

        def _ufw_run(cmd: str) -> str:
            return run_remote(client, cmd, sudo=True, timeout=60)

        print(f"[kiosk-alert] persist ufw {ALERT_LISTEN_PORT}/tcp from {prod_ip} only")
        print(apply_kiosk_alert_ufw(_ufw_run, prod_ip).strip())
        print("[ok] planes kiosk installed")
    finally:
        client.close()


if __name__ == "__main__":
    main()
