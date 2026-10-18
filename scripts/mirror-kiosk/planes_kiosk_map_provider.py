"""Apply the kiosk-only compatibility provider without navigating the document."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo


def apply_night_basemap(evaluate, websocket):
    source = Path(__file__).with_name('planes-kiosk-night-basemap.js')
    return evaluate(websocket, source.read_text(encoding='utf-8'))


def kiosk_quiet_hours(hour=None):
    civil_hour = datetime.now(ZoneInfo('Europe/Berlin')).hour if hour is None else hour
    return civil_hour >= 22 or civil_hour < 7
