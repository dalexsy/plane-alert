#!/usr/bin/env python3
import json
import sys
import time
from pathlib import Path

import websocket

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
client = connect_pi(host, user)
try:
    targets = json.loads(run_remote(client, "curl -sS http://127.0.0.1:9222/json"))
    page = next(target for target in targets if target["type"] == "page")
    channel = client.get_transport().open_channel(
        "direct-tcpip", ("127.0.0.1", 9222), ("127.0.0.1", 0)
    )
    ws = websocket.create_connection(
        page["webSocketDebuggerUrl"],
        socket=channel,
        origin="http://127.0.0.1:9222",
        timeout=30,
    )
    next_id = 0

    if "--reload" in sys.argv:
        for method in ("Runtime.enable", "Log.enable", "Network.enable", "Page.enable"):
            next_id += 1
            ws.send(json.dumps({"id": next_id, "method": method}))
        next_id += 1
        ws.send(json.dumps({"id": next_id, "method": "Page.reload", "params": {"ignoreCache": True}}))
        deadline = time.time() + 25
        while time.time() < deadline:
            try:
                message = json.loads(ws.recv())
            except TimeoutError:
                break
            method = message.get("method", "")
            params = message.get("params", {})
            if method == "Runtime.exceptionThrown":
                print("---EXCEPTION---")
                print(json.dumps(params, indent=2))
            elif method == "Runtime.consoleAPICalled":
                values = [arg.get("value", arg.get("description")) for arg in params.get("args", [])]
                print(f"---CONSOLE {params.get('type')}--- {values}")
            elif method == "Log.entryAdded":
                print("---LOG---")
                print(json.dumps(params.get("entry"), indent=2))
            elif method == "Network.responseReceived" and "adsbPointProxy" in params.get("response", {}).get("url", ""):
                response = params["response"]
                print(f"---ADSB RESPONSE--- {response.get('status')} {response.get('mimeType')} {response.get('url')}")
        ws.close()
        raise SystemExit(0)

    def evaluate(label: str, expression: str):
        nonlocal_id = None
        global next_id
        next_id += 1
        nonlocal_id = next_id
        ws.send(json.dumps({
            "id": nonlocal_id,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expression,
                "awaitPromise": True,
                "returnByValue": True,
            },
        }))
        while True:
            response = json.loads(ws.recv())
            if response.get("id") == nonlocal_id:
                value = response.get("result", {}).get("result", {}).get("value", response)
                print(f"---{label}---")
                print(json.dumps(value, indent=2))
                return

    evaluate("PAGE", """({
      url: location.href,
      title: document.title,
      online: navigator.onLine,
      visibility: document.visibilityState,
      controlled: !!navigator.serviceWorker.controller,
      text: document.body.innerText.slice(0, 1500)
    })""")
    evaluate("STORAGE", """Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => /radius|filter|interval|exclude|location|lat|lon/i.test(key))
        .map((key) => [key, localStorage.getItem(key)])
    )""")
    evaluate("RESOURCES", """performance.getEntriesByType('resource')
      .filter((entry) => /adsbPointProxy|api\\/planes/.test(entry.name))
      .slice(-15)
      .map((entry) => ({name: entry.name, start: entry.startTime, duration: entry.duration, size: entry.transferSize}))""")
    evaluate("LIVE_FETCH", """fetch('/api/planes/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100', {cache:'no-store'})
      .then(async (response) => ({status: response.status, text: (await response.text()).slice(0, 200)}))
      .catch((error) => ({error: String(error)}))""")
    ws.close()
finally:
    client.close()
