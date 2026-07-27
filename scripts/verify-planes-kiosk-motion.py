#!/usr/bin/env python3
"""Prove planes.dryl.io kiosk motion is actually off — behavior, not flags.

Uses Chromium remote debugging on the Pi (:9222). Fails if any Web Animation
is running, marker transitions remain timed, or markers interpolate between
feed updates while animationsEnabled should be false.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import websocket

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote  # noqa: E402

PROBE_JS = r"""
(async () => {
  const markers = [...document.querySelectorAll('.plane-marker')].slice(0, 24);
  const snap = () => markers.map((el) => {
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      cls: el.className?.toString() || '',
      x: +r.x.toFixed(2),
      y: +r.y.toFixed(2),
      transform: c.transform,
      animation: c.animationName,
      duration: c.animationDuration,
      transition: c.transitionDuration,
    };
  });
  const before = snap();
  await new Promise((r) => setTimeout(r, 2500));
  const after = snap();
  const moved = before.filter((b, i) => {
    const a = after[i];
    if (!a) return false;
    return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || a.transform !== b.transform;
  }).length;
  const running = document.getAnimations().filter((a) => a.playState === 'running');
  const timedTransitions = markers.filter((el) => {
    const d = getComputedStyle(el).transitionDuration;
    return d && d !== '0s' && !d.split(',').every((p) => p.trim() === '0s');
  }).length;
  const rainKids = document.querySelectorAll('app-rain-overlay .rain-drop, app-rain-overlay [class*="drop"]').length;
  const swallowKids = document.querySelectorAll('app-swallow-animation app-swallow-bird, app-swallow-animation .swallow').length;
  const leafKids = document.querySelectorAll('app-fall-leaves-animation app-fall-leaf, app-fall-leaves-animation .leaf').length;
  return {
    url: location.href,
    storedAnimations: localStorage.getItem('animationsEnabled'),
    bodyClass: document.body.className,
    runningCount: running.length,
    running: running.slice(0, 12).map((a) => ({
      playState: a.playState,
      currentTime: a.currentTime,
      target: a.effect?.target?.className?.toString() || '',
    })),
    timedTransitions,
    movedMarkers: moved,
    decorative: { rainKids, swallowKids, leafKids },
    markerSample: before.slice(0, 4),
  };
})()
"""


def cdp_evaluate(ws: websocket.WebSocket, expression: str, timeout_s: float = 20) -> dict:
    req_id = int(time.time() * 1000) % 1_000_000
    ws.send(
        json.dumps(
            {
                "id": req_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": expression,
                    "awaitPromise": True,
                    "returnByValue": True,
                },
            }
        )
    )
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        msg = json.loads(ws.recv())
        if msg.get("id") != req_id:
            continue
        if "error" in msg:
            raise RuntimeError(msg["error"])
        result = msg.get("result", {}).get("result", {})
        if result.get("subtype") == "error":
            raise RuntimeError(result.get("description") or result)
        return result.get("value") or {}
    raise TimeoutError("CDP evaluate timed out")


def main() -> int:
    host, user, _ = magicmirror_settings()
    client = connect_pi(host, user)
    try:
        targets = json.loads(run_remote(client, "curl -s http://127.0.0.1:9222/json"))
        target = next(
            (
                t
                for t in targets
                if t.get("type") == "page" and "planes.dryl.io" in t.get("url", "")
            ),
            None,
        )
        if not target:
            print("[fail] no planes.dryl.io Chromium target on :9222")
            return 1
        if "kiosk=1" not in target.get("url", ""):
            print(f"[fail] kiosk URL missing ?kiosk=1 — {target.get('url')}")
            return 1

        channel = client.get_transport().open_channel(
            "direct-tcpip", ("127.0.0.1", 9222), ("127.0.0.1", 0)
        )
        ws = websocket.create_connection(
            target["webSocketDebuggerUrl"],
            socket=channel,
            origin="http://127.0.0.1:9222",
            timeout=20,
        )
        try:
            probe = cdp_evaluate(ws, PROBE_JS)
        finally:
            ws.close()
    finally:
        client.close()

    print(json.dumps(probe, indent=2))
    fails: list[str] = []
    if probe.get("storedAnimations") != "false":
        fails.append(
            f"stored animationsEnabled={probe.get('storedAnimations')!r} (diagnostic)"
        )
    if probe.get("runningCount", 0) > 0:
        fails.append(f"{probe['runningCount']} running Web Animations")
    if probe.get("timedTransitions", 0) > 0:
        fails.append(f"{probe['timedTransitions']} markers with non-zero transition")
    if probe.get("movedMarkers", 0) > 0:
        fails.append(
            f"{probe['movedMarkers']} markers interpolated over 2.5s while motion off"
        )
    decorative = probe.get("decorative") or {}
    for key in ("rainKids", "swallowKids", "leafKids"):
        if int(decorative.get(key) or 0) > 0:
            fails.append(f"decorative {key}={decorative[key]} (RAF overlay still live)")

    if fails:
        for fail in fails:
            print(f"[fail] {fail}")
        return 1

    quote = (
        "kiosk motion off — 0 running animations, 0 timed marker transitions, "
        "0 decorative overlay children, markers stable over 2.5s"
    )
    print(f"[agent-required] QUOTE_VISIBLE: {quote}")
    print("[ok] planes kiosk motion gate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
