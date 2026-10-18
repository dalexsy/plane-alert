"""Apply the kiosk-only compatibility provider without navigating the document."""
from pathlib import Path


def apply_night_basemap(evaluate, websocket):
    source = Path(__file__).with_name('planes-kiosk-night-basemap.js')
    return evaluate(websocket, source.read_text(encoding='utf-8'))
