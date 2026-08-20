#!/usr/bin/env python3
"""LAN-only kiosk chime listener — pw-play stays on magicmirror (.74)."""
from __future__ import annotations

import hmac
import ipaddress
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

LISTEN_HOST = "0.0.0.0"
DEFAULT_PORT = 8796
PLAY_SCRIPT = Path(
    os.environ.get(
        "PLANES_KIOSK_ALERT_PLAY",
        "/home/pi/bin/planes-kiosk-alert-play.sh",
    )
)
ENV_FILE = Path(
    os.environ.get(
        "PLANES_KIOSK_ALERT_ENV",
        "/home/pi/.config/planes-kiosk/alert-play.env",
    )
)
PLAY_TIMEOUT_SEC = 40


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def play_token(env: dict[str, str] | None = None) -> str:
    merged = {**load_env_file(ENV_FILE), **os.environ, **(env or {})}
    return str(merged.get("PLANES_KIOSK_PLAY_TOKEN", "")).strip()


def listen_port(env: dict[str, str] | None = None) -> int:
    merged = {**load_env_file(ENV_FILE), **os.environ, **(env or {})}
    raw = str(merged.get("PLANES_KIOSK_ALERT_LISTEN_PORT", DEFAULT_PORT)).strip()
    try:
        port = int(raw)
    except ValueError:
        return DEFAULT_PORT
    return port if 1 <= port <= 65535 else DEFAULT_PORT


def is_lan_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return bool(
        addr.is_loopback
        or addr.is_private
        or addr.is_link_local
    )


def secrets_match(received: str, expected: str) -> bool:
    if not received or not expected:
        return False
    left = received.encode("utf-8")
    right = expected.encode("utf-8")
    if len(left) != len(right):
        hmac.compare_digest(right, right)
        return False
    return hmac.compare_digest(left, right)


def read_token(headers: dict[str, str]) -> str:
    lowered = {k.lower(): v for k, v in headers.items()}
    auth = str(lowered.get("authorization", "")).strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return str(lowered.get("x-planes-kiosk-play-token", "")).strip()


def variant_from_body(body: dict[str, Any]) -> str:
    raw = str(body.get("variant") or "").strip().lower()
    if raw in {"hercules", "a400", "default"}:
        return raw
    model = str(body.get("model") or "").lower()
    if "hercules" in model:
        return "hercules"
    if "a400" in model.replace(" ", "") or "a-400" in model:
        return "a400"
    return "default"


def play_variant(variant: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("XDG_RUNTIME_DIR", "/run/user/1000")
    return subprocess.run(
        [str(PLAY_SCRIPT), variant],
        check=False,
        capture_output=True,
        text=True,
        timeout=PLAY_TIMEOUT_SEC,
        env=env,
    )


class KioskAlertHandler(BaseHTTPRequestHandler):
    server_version = "planes-kiosk-alert/1"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if not is_lan_ip(self.client_address[0]):
            self._json(403, {"ok": False, "error": "lan-only"})
            return
        path = urlparse(self.path).path
        if path in {"/", "/health"}:
            self._json(200, {"ok": True, "service": "planes-kiosk-alert"})
            return
        self._json(404, {"ok": False, "error": "not-found"})

    def do_POST(self) -> None:
        if not is_lan_ip(self.client_address[0]):
            self._json(403, {"ok": False, "error": "lan-only"})
            return
        if urlparse(self.path).path != "/play":
            self._json(404, {"ok": False, "error": "not-found"})
            return
        expected = play_token()
        if not secrets_match(read_token(dict(self.headers)), expected):
            self._json(401, {"ok": False, "error": "unauthorized"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(body, dict):
                raise ValueError("body")
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self._json(400, {"ok": False, "error": "bad-json"})
            return
        variant = variant_from_body(body)
        try:
            result = play_variant(variant)
        except (OSError, subprocess.TimeoutExpired) as err:
            self._json(500, {"ok": False, "error": str(err)[:200]})
            return
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "play-failed").strip()
            self._json(500, {"ok": False, "error": err[:300], "variant": variant})
            return
        self._json(
            200,
            {
                "ok": True,
                "variant": variant,
                "icao": str(body.get("icao") or ""),
            },
        )


def self_test() -> None:
    assert is_lan_ip("127.0.0.1")
    assert is_lan_ip("::1")
    assert is_lan_ip("192.168.178.79")
    assert is_lan_ip("192.168.178.74")
    assert not is_lan_ip("8.8.8.8")
    assert not is_lan_ip("not-an-ip")
    assert variant_from_body({"variant": "hercules"}) == "hercules"
    assert variant_from_body({"model": "Lockheed C-130 Hercules"}) == "hercules"
    assert variant_from_body({"model": "Airbus A400M"}) == "a400"
    assert variant_from_body({}) == "default"
    assert secrets_match("abc", "abc")
    assert not secrets_match("abc", "abd")
    assert not secrets_match("", "abc")
    assert read_token({"Authorization": "Bearer secret"}) == "secret"
    print("[ok] planes-kiosk-alert-listen self-test")


def main() -> None:
    if "--self-test" in sys.argv:
        self_test()
        return
    token = play_token()
    if not token:
        raise SystemExit(
            "PLANES_KIOSK_PLAY_TOKEN missing "
            f"(set env or {ENV_FILE})"
        )
    port = listen_port()
    server = ThreadingHTTPServer((LISTEN_HOST, port), KioskAlertHandler)
    print(f"planes-kiosk-alert listening on {LISTEN_HOST}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
