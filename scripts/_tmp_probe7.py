#!/usr/bin/env python3
from __future__ import annotations
import json, math, socket, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
import paramiko
from pi_dryl_common import ssh_key_paths

def hav(lat1,lon1,lat2,lon2):
    R=6371
    p1,p2=math.radians(lat1),math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

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
    print((so.read()+se.read()).decode("utf-8","replace")[-8000:])

j,t=connect()
try:
    run(t, r"""python3 - <<'PY'
import json,math,urllib.request
def hav(lat1,lon1,lat2,lon2):
    R=6371
    p1,p2=math.radians(lat1),math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))
home=(52.4605886,13.523268)
url='https://api.airplanes.live/v2/mil'
req=urllib.request.Request(url, headers={'User-Agent':'planes-api','Accept':'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    ac=json.load(resp).get('ac') or []
near=[]
for p in ac:
    lat,lon=p.get('lat'),p.get('lon')
    if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):
        continue
    d=hav(home[0],home[1],lat,lon)
    if d<=100:
        near.append((round(d,1), p.get('hex'), (p.get('flight') or '').strip(), p.get('dbFlags'), p.get('mil')))
near.sort()
print('mil total', len(ac), 'within 100km of home', len(near))
for row in near[:20]:
    print(row)
PY""")
    # Prove FieldValue patch in running process
    run(t, r"""cd /home/pi/planes-api && node -e "
const admin=require('firebase-admin');
const {patchAdminFirestoreNamespace, LocalFieldValue, LocalTimestamp}=require('./lib/local-firestore');
console.log('before', typeof admin.firestore.FieldValue, admin.firestore.FieldValue.serverTimestamp());
patchAdminFirestoreNamespace(admin);
const ts=admin.firestore.FieldValue.serverTimestamp();
const exp=admin.firestore.Timestamp.fromMillis(Date.now());
console.log('after serverTimestamp', ts, typeof ts);
console.log('after Timestamp', exp, JSON.stringify(exp), exp.toMillis && exp.toMillis());
" 2>&1""")
finally:
    t.close(); j.close()
