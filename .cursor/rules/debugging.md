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
| Same plane twice in one Pushover inbox | Prod-only send. Staging hostname/`PLANES_API_PUSHOVER_ENABLED=0` mute. `verifyPlanesPushDedup` checks ledger **and** staging `pushoverSendEnabled:false` | Treat prod `/health` unique ledger as proof; copy prod `.env` to staging |

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
- Do not restore per-device cooldown or a second API send. One account, one `device=galaxys24,pixel10` send. A “missed phone” story is not the bug and doubles the inbox (`5cc5b90`)
- Do not loop `notifyForDevice` per phone and rely on cooldown — one notify pass per userKey (2026-08-14 still doubled)
- Do not treat `/health` ok as a unique inbox. 30 min TTL re-sent `43C39D` the same Berlin day; Daryl is not the sensor — fail `verifyPlanesPushDedup` on the send ledger
- Do not treat a unique **prod** send ledger as proof. dryl-staging planes-api was active with the same Pushover account (2026-08-16) so every alert hit phones twice

Older: `.cursor/rules/debugging-archive.md`

---

## Deploy timing (auto)

Median **136s** · wait `block_until_ms` **120000** chunks, total **214474** · details: `.dryl-deploy-timing.json`

Updated: 2026-08-15T09:44:52Z · source: `directory/data/deploy-timing.json`

<!-- end deploy-timing -->

---

## Deploy & verify

- Ship SPA: `npm run deploy:dryl` on dryl-prod
- Kiosk: install/watch on magicmirror `.74` only
- Prove: production PNG + `QUOTE_VISIBLE`
