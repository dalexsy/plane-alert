#!/usr/bin/env python3
"""Soft-heal planes kiosk when Chromium is stuck on about:blank / empty app-root.

Uses CDP on 127.0.0.1:9222. Prefer Page.reload / navigate over killing Chromium
so quiet-hours bedroom flash is avoided.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request

try:
    import websocket
except ImportError:
    print("planes-kiosk-page-heal: websocket-client missing", file=sys.stderr)
    sys.exit(0)

CDP_LIST = "http://127.0.0.1:9222/json/list"
PLANES_URL = "https://planes.dryl.io/?kiosk=1"


def _call(ws: websocket.WebSocket, method: str, params: dict | None = None) -> dict:
    req_id = int(time.time() * 1000) % 1_000_000
    payload: dict = {"id": req_id, "method": method}
    if params is not None:
        payload["params"] = params
    ws.send(json.dumps(payload))
    deadline = time.time() + 15
    while time.time() < deadline:
        msg = json.loads(ws.recv())
        if msg.get("id") != req_id:
            continue
        if "error" in msg:
            raise RuntimeError(msg["error"])
        return msg.get("result") or {}
    raise TimeoutError(method)


def _evaluate(ws: websocket.WebSocket, expression: str) -> dict:
    result = _call(
        ws,
        "Runtime.evaluate",
        {"expression": expression, "awaitPromise": True, "returnByValue": True},
    ).get("result", {})
    if result.get("subtype") == "error":
        raise RuntimeError(result.get("description") or result)
    value = result.get("value")
    return value if isinstance(value, dict) else {}


def _page_state(ws: websocket.WebSocket) -> dict:
    return _evaluate(
        ws,
        """(() => ({
  href: location.href,
  title: document.title || '',
  appRootLen: ((document.querySelector('app-root')||{}).innerHTML||'').length,
  hasMap: !!document.querySelector('.leaflet-container, canvas, app-map, #map'),
  bodyLen: (document.body && document.body.innerText || '').trim().length
}))()""",
    )


def _is_blank(state: dict) -> bool:
    href = (state.get("href") or "").strip().lower()
    if href in ("about:blank", "about:blank/", ""):
        return True
    if "planes.dryl.io" not in href and "about:" in href:
        return True
    app_len = int(state.get("appRootLen") or 0)
    body_len = int(state.get("bodyLen") or 0)
    has_map = bool(state.get("hasMap"))
    title = (state.get("title") or "").strip()
    if "planes.dryl.io" in href and app_len < 200 and body_len < 20 and not has_map:
        return True
    if "planes.dryl.io" in href and not title and app_len < 200 and not has_map:
        return True
    return False


def main() -> int:
    try:
        with urllib.request.urlopen(CDP_LIST, timeout=4) as resp:
            targets = json.load(resp)
    except Exception as exc:
        print(f"planes-kiosk-page-heal: cdp list failed: {exc}", file=sys.stderr)
        return 0

    page = next((t for t in targets if t.get("type") == "page"), None)
    if not page or not page.get("webSocketDebuggerUrl"):
        print("planes-kiosk-page-heal: no page target", file=sys.stderr)
        return 0

    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=15)
    try:
        state = _page_state(ws)
        if not _is_blank(state):
            print(
                f"planes-kiosk-page-heal: ok href={state.get('href')} "
                f"appRootLen={state.get('appRootLen')} hasMap={state.get('hasMap')}"
            )
            return 0

        print(
            f"planes-kiosk-page-heal: blank detected href={state.get('href')} "
            f"appRootLen={state.get('appRootLen')} — soft reload",
            file=sys.stderr,
        )
        _call(ws, "Page.enable")
        href = (state.get("href") or "").lower()
        if "planes.dryl.io" in href:
            _call(ws, "Page.reload", {"ignoreCache": True})
        else:
            _call(ws, "Page.navigate", {"url": PLANES_URL})
        time.sleep(6)
        after = _page_state(ws)
        if _is_blank(after):
            print(
                f"planes-kiosk-page-heal: still blank after heal "
                f"href={after.get('href')} appRootLen={after.get('appRootLen')}",
                file=sys.stderr,
            )
            return 1
        print(
            f"planes-kiosk-page-heal: healed href={after.get('href')} "
            f"title={after.get('title')} hasMap={after.get('hasMap')}"
        )
        return 0
    finally:
        ws.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"planes-kiosk-page-heal: {exc}", file=sys.stderr)
        raise SystemExit(0)
