#!/usr/bin/env python3
"""Obtain dryl_session via login-json and import into Chromium user-data profile."""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import Cookie
from http.cookies import SimpleCookie
from http.cookiejar import MozillaCookieJar
from pathlib import Path

COOKIE_NAME = "dryl_session"
DEFAULT_LOGIN_URL = "http://127.0.0.1:8790/api/auth/login-json"
LOGIN_URL = os.environ.get("DRYL_AUTH_LOGIN_JSON", DEFAULT_LOGIN_URL)
PLANES_URL = os.environ.get("PLANES_KIOSK_URL", "https://planes.dryl.io/")
CONFIG_DIR = Path(os.environ.get("PLANES_KIOSK_CONFIG", "/home/pi/.config/planes-kiosk"))
PROFILE = Path(os.environ.get("PLANES_KIOSK_PROFILE", "/home/pi/.config/planes-kiosk-chromium"))
CREDS_FILE = CONFIG_DIR / "credentials.env"
JAR_FILE = CONFIG_DIR / "session.jar"
CHROMIUM_EPOCH_OFFSET = 11644473600  # seconds between 1601 and 1970


def load_credentials() -> tuple[str, str]:
    env_user = os.environ.get("DRYL_KIOSK_USER", "").strip()
    env_pass = os.environ.get("DRYL_KIOSK_PASSWORD", "").strip()
    if env_user and env_pass:
        return env_user, env_pass
    if not CREDS_FILE.is_file():
        raise SystemExit(f"missing {CREDS_FILE} (see credentials.env.example)")
    user = ""
    password = ""
    for line in CREDS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("DRYL_KIOSK_USER="):
            user = line.split("=", 1)[1].strip().strip('"').strip("'")
        if line.startswith("DRYL_KIOSK_PASSWORD="):
            password = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not user or not password:
        raise SystemExit(f"{CREDS_FILE} needs DRYL_KIOSK_USER and DRYL_KIOSK_PASSWORD")
    return user, password


def persist_session_token(token: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    jar = MozillaCookieJar(str(JAR_FILE))
    if JAR_FILE.is_file():
        jar.load(ignore_discard=True, ignore_expires=True)
    jar.set_cookie(
        Cookie(
            version=0,
            name=COOKIE_NAME,
            value=token,
            port=None,
            port_specified=False,
            domain=".dryl.io",
            domain_specified=True,
            domain_initial_dot=True,
            path="/",
            path_specified=True,
            secure=True,
            expires=int(time.time()) + 30 * 86400,
            discard=False,
            comment=None,
            comment_url=None,
            rest={"HttpOnly": None},
            rfc2109=False,
        ),
    )
    jar.save(ignore_discard=True, ignore_expires=True)


def clear_session_jar() -> None:
    """Drop cached session so a stale token cannot shadow a fresh Set-Cookie."""
    if JAR_FILE.is_file():
        JAR_FILE.unlink()


def login_json(user: str, password: str) -> str:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    # login-json is on 127.0.0.1 but Set-Cookie Domain=.dryl.io — cookiejar often
    # rejects that host/domain pair. Never reuse a prior jar entry as the token.
    clear_session_jar()

    body = json.dumps({"username": user, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        LOGIN_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    set_cookie = ""
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            headers = resp.headers
            if hasattr(headers, "get_all"):
                parts = headers.get_all("Set-Cookie") or headers.get_all("set-cookie") or []
                for part in parts:
                    if COOKIE_NAME.lower() in part.lower():
                        set_cookie = part
                        break
            if not set_cookie:
                set_cookie = headers.get("Set-Cookie") or headers.get("set-cookie") or ""
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        raise SystemExit(f"login-json HTTP {exc.code}: {detail}") from exc
    except OSError as exc:
        raise SystemExit(f"login-json failed: {exc}") from exc

    if not payload.get("ok"):
        raise SystemExit(f"login-json rejected: {payload}")

    token = token_from_set_cookie_header(set_cookie)
    if not token:
        raise SystemExit(f"login ok but no {COOKIE_NAME} cookie in response")
    persist_session_token(token)
    return token


def token_from_set_cookie_header(header: str) -> str:
    if not header:
        return ""
    # Prefer a direct parse — SimpleCookie can choke on multi-cookie joins.
    for part in header.split(","):
        for segment in part.split(";"):
            segment = segment.strip()
            if segment.lower().startswith(f"{COOKIE_NAME.lower()}="):
                raw = segment.split("=", 1)[1].strip().strip('"')
                try:
                    return urllib.parse.unquote(raw)
                except Exception:
                    return raw
    jar = SimpleCookie()
    try:
        jar.load(header)
    except Exception:
        return ""
    morsel = jar.get(COOKIE_NAME)
    if not morsel:
        return ""
    try:
        return urllib.parse.unquote(morsel.value)
    except Exception:
        return morsel.value


def chrome_time() -> int:
    return int((time.time() + CHROMIUM_EPOCH_OFFSET) * 1_000_000)


def import_cookie(token: str) -> None:
    PROFILE.mkdir(parents=True, exist_ok=True)
    db_path = PROFILE / "Default" / "Cookies"
    db_path.parent.mkdir(parents=True, exist_ok=True)

    expires = chrome_time() + 180 * 24 * 3600 * 1_000_000
    created = chrome_time()
    host = ".dryl.io"
    name = COOKIE_NAME
    path = "/"
    value = token

    conn = sqlite3.connect(str(db_path))
    try:
        cols = {
            row[1]: row
            for row in conn.execute("PRAGMA table_info(cookies)").fetchall()
        }
        if not cols:
            conn.execute(
                """
                CREATE TABLE cookies (
                  creation_utc INTEGER NOT NULL,
                  host_key TEXT NOT NULL,
                  name TEXT NOT NULL,
                  value TEXT NOT NULL,
                  path TEXT NOT NULL,
                  expires_utc INTEGER NOT NULL,
                  is_secure INTEGER NOT NULL,
                  is_httponly INTEGER NOT NULL,
                  last_access_utc INTEGER NOT NULL,
                  has_expires INTEGER NOT NULL DEFAULT 1,
                  is_persistent INTEGER NOT NULL DEFAULT 1,
                  priority INTEGER NOT NULL DEFAULT 1,
                  encrypted_value BLOB NOT NULL DEFAULT '',
                  samesite INTEGER NOT NULL DEFAULT 1
                )
                """
            )
            cols = {
                row[1]: row
                for row in conn.execute("PRAGMA table_info(cookies)").fetchall()
            }

        row = {c: None for c in cols}
        row.update(
            {
                "creation_utc": created,
                "host_key": host,
                "name": name,
                "value": value,
                "path": path,
                "expires_utc": expires,
                "is_secure": 1,
                "is_httponly": 1,
                "last_access_utc": created,
                "has_expires": 1,
                "is_persistent": 1,
                "priority": 1,
                "encrypted_value": b"",
                "samesite": 1,
                "source_scheme": 2,
                "source_port": -1,
                "last_update_utc": created,
                "top_frame_site_key": "",
                "source_type": 0,
                "is_same_party": 0,
            }
        )
        for col, meta in cols.items():
            if row.get(col) is None and meta[3]:  # NOT NULL without value
                row[col] = 0 if meta[2] in ("INTEGER", "INT") else ""

        conn.execute("DELETE FROM cookies WHERE host_key = ? AND name = ?", (host, name))
        names = [c for c in cols if c in row and row[c] is not None]
        placeholders = ", ".join("?" for _ in names)
        conn.execute(
            f"INSERT INTO cookies ({', '.join(names)}) VALUES ({placeholders})",
            [row[c] for c in names],
        )
        conn.commit()
    finally:
        conn.close()


def session_cookie_header() -> str | None:
    token = token_from_jar()
    if not token:
        return None
    return f"{COOKIE_NAME}={token}"


def _cookie_opener():
    jar = MozillaCookieJar(str(JAR_FILE))
    if JAR_FILE.is_file():
        jar.load(ignore_discard=True, ignore_expires=True)
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def _local_auth_reachable() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8790/health", timeout=2) as resp:
            return resp.status == 200
    except OSError:
        return False


def verify_session_cookie() -> bool:
    cookie_header = session_cookie_header()
    if not cookie_header:
        return False
    req = urllib.request.Request(
        "http://127.0.0.1:8790/api/auth/verify",
        method="GET",
        headers={
            "X-Dryl-Host": "planes.dryl.io",
            "Cookie": cookie_header,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except OSError:
        return False


def fetch_planes_html() -> tuple[bool, str]:
    if not JAR_FILE.is_file():
        return False, ""

    if _local_auth_reachable():
        if not verify_session_cookie():
            return False, "auth-verify-failed"
        cookie_header = session_cookie_header()
        if not cookie_header:
            return False, "missing-cookie"
        req = urllib.request.Request(
            "http://127.0.0.1:8080/",
            method="GET",
            headers={
                "Host": "planes.dryl.io",
                "Cookie": cookie_header,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read(120_000).decode("utf-8", errors="replace")
                if resp.status != 200:
                    return False, "nginx-non-200"
                if "<app-root" not in body:
                    return False, "missing-app-root"
                if "__DRYL_APP_ID__" in body and "planes" not in body:
                    return False, "wrong-app-id"
                return True, "local-nginx"
        except OSError:
            return False, "local-nginx-error"

    opener = _cookie_opener()
    req = urllib.request.Request(PLANES_URL, method="GET")
    try:
        with opener.open(req, timeout=15) as resp:
            final = resp.geturl()
            if "login" in final:
                return False, final
            body = resp.read(120_000).decode("utf-8", errors="replace")
            if resp.status != 200:
                return False, final
            if "<app-root" not in body:
                return False, final
            if "main-" not in body and "scripts" not in body:
                return False, final
            return True, final
    except OSError:
        return False, ""


def verify_planes() -> bool:
    ok, _final = fetch_planes_html()
    return ok


def token_from_jar() -> str:
    if not JAR_FILE.is_file():
        return ""
    jar = MozillaCookieJar(str(JAR_FILE))
    jar.load(ignore_discard=True, ignore_expires=True)
    for cookie in jar:
        if cookie.name == COOKIE_NAME:
            return cookie.value
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="exit 0 when planes HTML is reachable with a valid session",
    )
    args = parser.parse_args()

    if args.verify_only:
        ok, reason = fetch_planes_html()
        if not ok and reason:
            print(f"[verify-only] fail: {reason}", file=sys.stderr)
        sys.exit(0 if ok else 1)

    jar_token = token_from_jar()
    if jar_token:
        import_cookie(jar_token)
    ok, reason = fetch_planes_html()
    if ok:
        print("[ok] planes session already valid")
        return
    if reason:
        print(f"[info] cached session unusable ({reason}) — logging in again")
    clear_session_jar()
    user, password = load_credentials()
    token = login_json(user, password)
    import_cookie(token)
    ok, reason = fetch_planes_html()
    if ok:
        print("[ok] dryl_session imported — planes reachable")
        return
    print(
        f"[warn] cookie imported but planes verify still failed ({reason or 'unknown'})",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
