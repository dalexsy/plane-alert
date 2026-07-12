#!/usr/bin/env python3
"""Audit planes-api on Pi: service health, store, notification pipeline."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, load_manifest, run_remote, pi_settings  # noqa: E402

REMOTE_STORE = "/home/pi/planes-api/data/planes-api-store.json"


def main() -> None:
    manifest = load_manifest()
    host, user, _ = pi_settings(manifest)
    client = connect_pi(host, user)

    cmds = [
        "systemctl is-active planes-api.service",
        "journalctl -u planes-api.service -n 50 --no-pager",
        "test -f /home/pi/planes-api/.env && echo env-exists || echo env-missing",
        "grep -c '^PUSHOVER_API_TOKEN=' /home/pi/planes-api/.env 2>/dev/null || echo 0",
        f"stat -c '%y %s' {REMOTE_STORE} 2>/dev/null || echo store-missing",
        "stat -c '%y' /home/pi/planes-api/lib/pi-server.js",
    ]
    for cmd in cmds:
        print("===", cmd)
        print(run_remote(client, cmd, timeout=60).strip())
        print()

    py = f"""
import json, time
from datetime import datetime
path = {REMOTE_STORE!r}
with open(path) as f:
    d = json.load(f)
cols = d.get('collections', {{}})
dev = cols.get('deviceTokens', {{}})
health_doc = cols.get('systemHealth', {{}}).get('notificationHealth', {{}})
print('device_count', len(dev))
for doc_id, data in dev.items():
    key = (data.get('pushoverUserKey') or '')[:8]
    home = data.get('home') or data.get('location')
    radius = data.get('radiusKm')
    name = data.get('deviceName') or data.get('pushoverDeviceName') or '?'
    last = data.get('lastNotified') or {{}}
    print(f'  {{doc_id[:20]}} key={{key}} device={{name}} radius={{radius}} home={{home}} lastNotified={{len(last)}}')
print('notification_health', json.dumps(health_doc, indent=2))
now = int(time.time() * 1000)
for field in ('processPlanesLastSuccessAt', 'collectAircraftLastSuccessAt', 'lastNotificationSentAt'):
    ts = health_doc.get(field)
    if ts:
        age_min = (now - ts) / 60000
        print(f'  {{field}}: {{datetime.fromtimestamp(ts/1000).isoformat()}} ({{age_min:.0f}} min ago)')
    else:
        print(f'  {{field}}: never')
"""
    print("=== store inspection")
    print(run_remote(client, f"python3 -c {repr(py)}", timeout=60).strip())

    client.close()


if __name__ == "__main__":
    main()