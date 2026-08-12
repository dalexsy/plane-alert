#!/usr/bin/env python3
"""Soft-heal planes kiosk when Chromium is stuck blank or empty of planes.

Uses CDP on 127.0.0.1:9222. Prefer Page.reload / navigate over killing Chromium
so quiet-hours bedroom flash is avoided.

Also heals the post-split case: SPA shell + map render, but zero markers while
the public ADS-B API still returns aircraft (watch used to log and leave it).
"""
from __future__ import annotations

import json
import os
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
ADS_URL = (
    "https://planes.dryl.io/api/planes/adsbPointProxy"
    "?lat=52.4605886&lon=13.523268&radiusKm=100"
)
FORCE = os.environ.get("PLANES_KIOSK_PAGE_HEAL_FORCE", "").strip() in ("1", "true", "yes")


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
  markerCount: document.querySelectorAll(
    '.leaflet-marker-pane .leaflet-marker-icon, .leaflet-marker-icon'
  ).length,
  bodyLen: (document.body && document.body.innerText || '').trim().length
}))()""",
    )


def _adsb_count() -> int:
    try:
        with urllib.request.urlopen(ADS_URL, timeout=10) as resp:
            data = json.load(resp)
        ac = data.get("ac") if isinstance(data, dict) else None
        return len(ac) if isinstance(ac, list) else 0
    except Exception:
        return -1


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


def _is_empty_stuck(state: dict) -> bool:
    """Map shell up but no markers while ADS-B still has aircraft nearby."""
    if "planes.dryl.io" not in (state.get("href") or "").lower():
        return False
    if not bool(state.get("hasMap")):
        return False
    if int(state.get("markerCount") or 0) > 0:
        return False
    api = _adsb_count()
    return api >= 3


def _needs_heal(state: dict) -> str | None:
    if FORCE:
        return "force"
    if _is_blank(state):
        return "blank"
    if _is_empty_stuck(state):
        return f"empty-stuck api={_adsb_count()} markers=0"
    return None


def _soft_reload(ws: websocket.WebSocket, state: dict) -> dict:
    _call(ws, "Page.enable")
    href = (state.get("href") or "").lower()
    if "planes.dryl.io" in href:
        _call(ws, "Page.reload", {"ignoreCache": True})
    else:
        _call(ws, "Page.navigate", {"url": PLANES_URL})
    time.sleep(8)
    return _page_state(ws)


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
        reason = _needs_heal(state)
        if not reason:
            print(
                f"planes-kiosk-page-heal: ok href={state.get('href')} "
                f"appRootLen={state.get('appRootLen')} hasMap={state.get('hasMap')} "
                f"markers={state.get('markerCount')}"
            )
            return 0

        print(
            f"planes-kiosk-page-heal: heal reason={reason} href={state.get('href')} "
            f"appRootLen={state.get('appRootLen')} markers={state.get('markerCount')} "
            "— soft reload",
            file=sys.stderr,
        )
        after = _soft_reload(ws, state)
        if _needs_heal(after):
            print(
                f"planes-kiosk-page-heal: still unhealthy after heal "
                f"href={after.get('href')} markers={after.get('markerCount')}",
                file=sys.stderr,
            )
            return 1
        print(
            f"planes-kiosk-page-heal: healed href={after.get('href')} "
            f"title={after.get('title')} markers={after.get('markerCount')}"
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
