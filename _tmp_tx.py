#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(r"c:\Users\dalex\Repos\directory\scripts")))
from pi_dryl_common import connect_pi, load_manifest, run_remote, pi_settings
m=load_manifest(); h,u,_=pi_settings(m); c=connect_pi(h,u)
# full error around 3F93E4 + any transaction failed since jul 15
print(run_remote(c, "bash -lc \"journalctl -u planes-api.service --since '2026-07-15' --no-pager | grep -E 'transaction failed|Transaction result|Released notification|Sent Pushover|Pushover API|messagesToSend.:[1-9]|Failed to send' | tail -n 60 || true\"", timeout=120))
# cooldown docs for 3F93E4
print(run_remote(c, "python3 - <<'PY'\nimport json\nd=json.load(open('/home/pi/planes-api/data/planes-api-store.json'))\ncds=d['notification-cooldowns']\nfor k,v in cds.items():\n  if '3F93E4' in k.upper() or '3f93e4' in k:\n    print(k, v)\nPY", timeout=60))
c.close()
