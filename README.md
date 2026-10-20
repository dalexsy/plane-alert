# Plane Alert

Live ADS-B map and alert stack for the home antenna: radius search around an address or home point, military/special aircraft highlighting, weather and sky overlays, Pushover notifications, and a dedicated kitchen kiosk. Production app: [https://planes.dryl.io](https://planes.dryl.io).

## What ships where

| Piece | Role |
|-------|------|
| **This repo (`src/`)** | Angular SPA — map UI, settings, device registration UI |
| **`functions/`** | **planes-api** — Express on dryl-prod (`.79`), local JSON store (no Firestore / no Firebase hosting) |
| **magicmirror (`.74`)** | Full-screen Chromium kiosk; speaker for alert chimes |
| **Home tar1090** | Primary ADS-B feed on the LAN (see antenna section) |

Nginx on dryl-prod serves the SPA and proxies `/api/planes/*` to planes-api.

## Features (SPA)

- Map centered on home, current location, or a searched address, with configurable search radius
- Live aircraft from multiple ADS-B sources (server-side proxy avoids browser CORS limits)
- Military and special-aircraft detection (shared rules in `@plane-alert/shared`)
- Operator logos, country flags, window-view / altitude band overlays, rain and cloud layers
- Date, time, and temperature for the map center’s timezone
- **Antenna sightings** map: every unique ICAO the home feed has ever reported ([`/sightings`](https://planes.dryl.io/sightings); toolbar cell-tower icon on the main map)
- Military history and related panels backed by planes-api

## Push notifications (Pushover)

Alerts are **server-side only**. The browser does not use FCM, Firestore, or a notification service worker.

1. Create an account at [Pushover](https://pushover.net).
2. On a phone or desktop browser, open [https://planes.dryl.io/?setup=pushover](https://planes.dryl.io/?setup=pushover) and enter your Pushover user key.
3. Set home location and alert radius in the app.

planes-api polls ADS-B on a schedule, applies military/special filters and deduplication, and sends Pushover messages. Staging and prod send gates are separate (`PLANES_API_PUSHOVER_ENABLED` on the server). See `.cursor/rules/debugging.md` for dedup and kiosk-audio pitfalls.

## Antenna sightings

Tracker of every unique aircraft the home ADS-B antenna has seen.

- **Open:** [https://planes.dryl.io/sightings](https://planes.dryl.io/sightings) (main map: cell-tower icon). The kiosk stays on the main map.
- **Feed:** `http://192.168.178.27/tar1090/data/aircraft.json` (tar1090 UI: `http://192.168.178.27/tar1090/`).
- **Poller:** planes-api on dryl-prod reads the feed every 12s and upserts by ICAO hex.
- **Store:** `/home/pi/planes-api/data/antenna-sightings.json` on dryl-prod.

Optional env on the Pi (in `/home/pi/planes-api/.env` — **do not overwrite that file from a laptop**):

```
PLANES_ANTENNA_FEED_URL=http://192.168.178.27/tar1090/data/aircraft.json
PLANES_ANTENNA_POLL_MS=12000
PLANES_ANTENNA_SIGHTINGS_PATH=/home/pi/planes-api/data/antenna-sightings.json
PLANES_ANTENNA_ENABLED=1
```

Set `PLANES_ANTENNA_ENABLED=0` to pause the poller. Defaults match the home tar1090 URL when unset.

## Shared detection logic

`shared/` (`@plane-alert/shared`) holds country, military, and geo helpers used by the SPA and planes-api. Build before the app: `npm run build:shared` (also run from `prebuild`).

## Local development

```bash
npm install
npm start
```

`npm start` runs the small local `server.js` helper and `ng serve` with `proxy.conf.json` so `/api/planes` can reach a configured backend.

Production build:

```bash
npm run build
```

Output: `dist/plane-alert/browser`.

## Deploy and verify (dryl.io)

From this repo on a machine allowed to deploy:

```bash
npm run deploy:staging
npm run verify:staging
# merge to main, then:
npm run deploy:dryl
npm run verify:console
npm run verify:visual
```

Backend (planes-api) on dryl-prod: `python scripts/pi-install-planes-api.py` (see `package.json` scripts). Kiosk on magicmirror: `python scripts/pi-install-planes-kiosk.py`.

Agent/deploy detail: `../directory/.cursor/rules/deploy-verify-loop.mdc` and this repo’s `.cursor/rules/debugging.md`.

## Geocoding (address lookup)

Reverse geocoding turns map coordinates into addresses. If lookups time out (504), you can disable client geocoding temporarily:

```javascript
localStorage.setItem("disable-geocoding", "true");
location.reload();
```

Re-enable:

```javascript
localStorage.removeItem("disable-geocoding");
location.reload();
```

## Tests and lint

```bash
npm run lint:ui
npm test
```

planes-api self-tests and Pushover gate tests: `npm run test:local-tx` (see `package.json`).
