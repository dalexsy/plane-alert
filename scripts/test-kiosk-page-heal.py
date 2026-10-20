import importlib.util
from pathlib import Path
import sys
import types

root=Path(__file__).parent/'mirror-kiosk'
sys.path.insert(0,str(root))
sys.modules.setdefault('websocket',types.SimpleNamespace(WebSocket=object))
spec=importlib.util.spec_from_file_location('kiosk_page_heal',root/'planes-kiosk-page-heal.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
from planes_kiosk_map_provider import kiosk_quiet_hours
assert all(kiosk_quiet_hours(hour)==(hour>=22 or hour<7) for hour in range(24))
calls=[];module._call=lambda *args:calls.append(args)
module._page_state=lambda ws:{'hasMap':True}
module.time.sleep=lambda seconds:None
module.kiosk_quiet_hours=lambda:True
try:
 module._soft_reload(object(),{'href':'https://planes.dryl.io/?kiosk=1'})
 raise AssertionError('quiet-hours navigation was allowed')
except RuntimeError as exc:
 assert 'quiet hours' in str(exc)
assert calls==[], 'quiet-hours refusal must precede every CDP navigation effect'
module.kiosk_quiet_hours=lambda:False
assert module._soft_reload(object(),{'href':'https://planes.dryl.io/?kiosk=1'})=={'hasMap':True}
assert any(args[1]=='Page.reload' for args in calls)
print('test-kiosk-page-heal.py: PASS')
