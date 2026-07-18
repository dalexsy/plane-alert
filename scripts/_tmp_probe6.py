#!/usr/bin/env python3
from __future__ import annotations
import socket, sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
import paramiko
from pi_dryl_common import ssh_key_paths

def connect():
    keys = ssh_key_paths()
    jump = paramiko.SSHClient(); jump.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    jsock = socket.socket(); jsock.settimeout(20); jsock.connect(("192.168.178.43", 22))
    jump.connect("192.168.178.43", 22, "barista", sock=jsock, allow_agent=True, look_for_keys=True, key_filename=keys or None, timeout=20)
    ch = jump.get_transport().open_channel("direct-tcpip", ("192.168.178.74", 22), ("127.0.0.1", 0))
    t = paramiko.SSHClient(); t.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    t.connect("192.168.178.74", 22, "pi", sock=ch, allow_agent=True, look_for_keys=True, key_filename=keys or None, timeout=30)
    return jump, t

def run(t, cmd, timeout=120):
    print("====", cmd[:160])
    _, so, se = t.exec_command(cmd, timeout=timeout)
    print((so.read()+se.read()).decode("utf-8","replace")[-10000:])

j,t = connect()
try:
    run(t, r"""python3 - <<'PY'
import json
store=json.load(open('/home/pi/planes-api/data/planes-api-store.json'))
for kid,doc in store.get('aircraft-snapshots',{}).items():
    d=doc.get('data',doc)
    print('KEY', kid)
    print('  timestamp', repr(d.get('timestamp'))[:200])
    print('  expiresAt', repr(d.get('expiresAt'))[:200])
    print('  location', d.get('location'))
    print('  deviceCount', d.get('deviceCount'), 'devices', d.get('devices'))
    print('  aircraftCount', len(d.get('aircraft') or []))
PY""")
    # Check how many aircraft a live point query returns for home vs whether mil are included
    run(t, r"""python3 - <<'PY'
import json,urllib.request,ssl
lat,lon,r_km=52.4605886,13.523268,100
r_nm=r_km/1.852
for base in ['https://api.airplanes.live','https://api.adsb.lol']:
  url=f'{base}/v2/point/{lat}/{lon}/{r_nm:.2f}'
  try:
    req=urllib.request.Request(url, headers={'User-Agent':'planes-api','Accept':'application/json'})
    with urllib.request.urlopen(req, timeout=8) as resp:
      data=json.load(resp)
    ac=data.get('ac') or []
    mil=[p for p in ac if p.get('dbFlags')==1 or p.get('mil') in (True,1,'1') or (p.get('flight') or '').strip().startswith(('GAF','RCH','NAF'))]
    print(base, 'total', len(ac), 'milish', len(mil), 'sample mil', [(p.get('hex'),p.get('flight'),p.get('dbFlags')) for p in mil[:8]])
  except Exception as e:
    print(base, 'ERR', e)
# also mil endpoint
for base in ['https://api.airplanes.live','https://api.adsb.lol']:
  for path in ['/v2/mil','/v2/mlat']:
    url=base+path
    try:
      req=urllib.request.Request(url, headers={'User-Agent':'planes-api','Accept':'application/json'})
      with urllib.request.urlopen(req, timeout=8) as resp:
        data=json.load(resp)
      ac=data.get('ac') or []
      print(base+path, 'total', len(ac))
    except Exception as e:
      print(base+path, 'ERR', e)
PY""")
finally:
    t.close(); j.close()
