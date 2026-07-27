"""Small Chrome DevTools helpers for the remote Planes kiosk."""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path

import websocket


def call(
    ws: websocket.WebSocket,
    method: str,
    params: dict | None = None,
    timeout_s: float = 20,
) -> dict:
    req_id = int(time.time() * 1000) % 1_000_000
    payload: dict = {"id": req_id, "method": method}
    if params is not None:
        payload["params"] = params
    ws.send(json.dumps(payload))
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        msg = json.loads(ws.recv())
        if msg.get("id") != req_id:
            continue
        if "error" in msg:
            raise RuntimeError(msg["error"])
        return msg.get("result") or {}
    raise TimeoutError(f"CDP {method} timed out")


def evaluate(
    ws: websocket.WebSocket,
    expression: str,
    timeout_s: float = 20,
) -> dict:
    result = call(
        ws,
        "Runtime.evaluate",
        {"expression": expression, "awaitPromise": True, "returnByValue": True},
        timeout_s,
    ).get("result", {})
    if result.get("subtype") == "error":
        raise RuntimeError(result.get("description") or result)
    return result.get("value") or {}


def screenshot(ws: websocket.WebSocket, dest: Path) -> Path:
    data = call(
        ws,
        "Page.captureScreenshot",
        {"format": "png", "fromSurface": True},
    ).get("data")
    if not data:
        raise RuntimeError("Page.captureScreenshot returned no data")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(base64.b64decode(data))
    return dest
