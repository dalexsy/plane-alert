#!/usr/bin/env python3
"""Live Pi probe: planes kiosk paint budget + motion flags.

Reports Chromium CPU/RSS, permanent tooltip/blur/drop-shadow counts, longtasks,
and whether product motion vs decorative FX are configured correctly.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent / "directory" / "scripts"))
from pi_dryl_common import connect_pi, kiosk_settings, run_remote  # noqa: E402

PROBE_JS = r"""
(async () => {
  const longTasks = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push(Math.round(e.duration));
      }
    });
    po.observe({ type: 'longtask', buffered: true });
  } catch {}

  await new Promise((r) => setTimeout(r, 3000));

  let blurOnKeyNodes = 0;
  document.querySelectorAll('.leaflet-tooltip, .plane-label.has-details').forEach((el) => {
    const cs = getComputedStyle(el);
    const f = cs.backdropFilter || cs.webkitBackdropFilter;
    if (f && f !== 'none') blurOnKeyNodes++;
  });
  let planeDropShadowCount = 0;
  document.querySelectorAll('.plane-marker').forEach((el) => {
    const f = getComputedStyle(el).filter;
    if (f && f !== 'none') planeDropShadowCount++;
  });
  const sample = document.querySelector('.leaflet-tooltip.plane-tooltip');
  let sampleStyle = null;
  if (sample) {
    const cs = getComputedStyle(sample);
    sampleStyle = {
      padding: cs.padding,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      borderTopWidth: cs.borderTopWidth,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
      height: Math.round(sample.getBoundingClientRect().height),
    };
  }
  const running = document.getAnimations().filter((a) => a.playState === 'running');
  return {
    url: location.href,
    body: document.body.className,
    animationsEnabled: localStorage.getItem('animationsEnabled'),
    showWindowView: localStorage.getItem('showWindowView'),
    markers: document.querySelectorAll('.plane-marker-container').length,
    tooltips: document.querySelectorAll('.leaflet-tooltip').length,
    permanentVisible: [...document.querySelectorAll('.leaflet-tooltip')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length,
    leftTooltips: document.querySelectorAll('.leaflet-tooltip.leaflet-tooltip-left').length,
    blurOnKeyNodes,
    planeDropShadowCount,
    runningAnims: running.length,
    rainKids: document.querySelectorAll('app-rain-overlay .rain-drop').length,
    swallowKids: document.querySelectorAll('app-swallow-animation app-swallow-bird, app-swallow-animation .swallow').length,
    leafKids: document.querySelectorAll('app-fall-leaves-animation app-fall-leaf, app-fall-leaves-animation .leaf').length,
    longTaskCount: longTasks.length,
    longTaskMaxMs: longTasks.length ? Math.max(...longTasks) : 0,
    sampleStyle,
    domNodes: document.getElementsByTagName('*').length,
  };
})()
"""


def main() -> int:
    host, user = kiosk_settings()
    client = connect_pi(host, user)

    print("=== chromium cpu (top 6) ===")
    print(
        run_remote(
            client,
            "ps -C chromium -o pid=,pcpu=,pmem=,rss= --sort=-pcpu | sed -n '1,6p'; "
            "echo LOAD; cat /proc/loadavg",
        )
    )

    b64 = __import__("base64").b64encode(PROBE_JS.encode()).decode()
    runner = f"""
node -e '
const http=require("http");
const WebSocket=require("ws");
const probe=Buffer.from("{b64}","base64").toString();
http.get("http://127.0.0.1:9222/json",(res)=>{{
  let d=""; res.on("data",c=>d+=c); res.on("end",()=>{{
    const page=JSON.parse(d).find(t=>t.type==="page");
    if(!page){{ console.error("no page"); process.exit(1); }}
    const ws=new WebSocket(page.webSocketDebuggerUrl);
    let id=0;
    const call=(method,params)=>new Promise((resolve,reject)=>{{
      const mid=++id;
      const onMsg=(raw)=>{{ const msg=JSON.parse(raw); if(msg.id===mid){{ ws.off("message",onMsg); resolve(msg); }} }};
      ws.on("message",onMsg);
      ws.send(JSON.stringify({{id:mid,method,params}}));
      setTimeout(()=>reject(new Error("timeout "+method)),20000);
    }});
    ws.on("open", async ()=>{{
      try {{
        await call("Runtime.enable");
        const res=await call("Runtime.evaluate",{{expression:probe,returnByValue:true,awaitPromise:true}});
        console.log(JSON.stringify(res.result.result.value,null,2));
        ws.close(); process.exit(0);
      }} catch(e) {{ console.error(e); process.exit(1); }}
    }});
  }});
}}).on("error",e=>{{ console.error(e); process.exit(1); }});
'
"""
    print("=== cdp probe ===")
    print(run_remote(client, runner))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"probe failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
