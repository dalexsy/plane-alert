# Debugging notes — plane-alert

**Budget:** ≤200 lines / ≤20 FE bullets. Symptoms + one-line do-nots only.  
**Archive:** `.cursor/rules/debugging-archive.md`  
**Hosts:** kiosk = magicmirror `.74`; SPA/API deploy = dryl-prod `.79` — see `directory/docs/INFRASTRUCTURE.md`

## Symptoms

| Symptom | Fix path | Do not |
|---------|----------|--------|
| Kiosk blank overnight / Chromium gone | `planes-kiosk.service` is **user** unit; watch resurrects via `chromium-missing`. `python scripts/pi-install-planes-kiosk.py --launch` | Treat system-bus `planes-kiosk` as truth |
| SPA “No planes” while traffic exists | Skip empty `adsb.lol` 200; add `opendata.adsb.fi`; OpenSky last-resort for live map. Prove `/api/planes/adsbPointProxy` | Page-heal when ADS-B empty; treat `ac=[]` as healthy |
| Kiosk empty after Pi split | Auth/API on dryl-prod `.79`; install kiosk on `.74` only — not via `magicmirror_settings()` (.79) | Require dryl-auth on kiosk; install kiosk via prod helper |

## Failed experiments (do not repeat)

- Empty map: do not treat HTTP 200 `{"ac":[]}` from adsb.lol as success
- After Pi split: do not check dryl-auth on magicmirror; do not install kiosk via `.79` helper
- Do not gate `planes-kiosk-watch` on system `planes-kiosk.service` (user unit)
- Kiosk: force animations off; solid label bg; treat mlat/unknown as junk
- Do not blame plane-motion alone for CPU — tooltips/blur/drop-shadow + dual RAF
- Do not persist in-range ICAOs before successful `pw-play`
- Seed seen ICAOs in **localStorage** (sessionStorage dies on daytime restart)
- Chime on every military/special delivery — not prefix-only / Pushover-success-only
- Quiet hours = **22:00–07:00** Berlin — not daytime mute
- Kiosk MP3 uses `plane.isMilitary` (DB or prefix); interrupt in-flight audio
- Remove speechSynthesis — MP3 only
- Never deploy non-`main` / Cloud Functions for planes-api

Older: `.cursor/rules/debugging-archive.md`

---

## Deploy timing (auto)

Median **146s** · wait `block_until_ms` **120000** chunks, total **218692** · details: `.dryl-deploy-timing.json`

Updated: 2026-08-13T06:51:19Z · source: `directory/data/deploy-timing.json`

<!-- end deploy-timing -->

---

## Deploy & verify

- Ship SPA: `npm run deploy:dryl` on dryl-prod
- Kiosk: install/watch on magicmirror `.74` only
- Prove: production PNG + `QUOTE_VISIBLE`
