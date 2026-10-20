# Security & API keys

## Never commit secrets

API tokens and shared secrets belong in **server `.env` files** or local `.env` (gitignored). Do not put them in the Angular bundle or commit them to git.

## Backend (planes-api)

Production API runs on dryl-prod as **planes-api** (built from `functions/`, local JSON store — not Google Cloud Functions or Firestore).

Secrets live in **`/home/pi/planes-api/.env`** on the Pi. Set them on the server; do not overwrite that file from a laptop deploy.

Typical keys:

| Variable | Purpose |
|----------|---------|
| `PUSHOVER_API_TOKEN` | Pushover application token (optional legacy alerts) |
| `PLANES_API_PUSHOVER_ENABLED` | `0` to mute Pushover sends |
| `ROW_SESSION_NOTIFY_SECRET` | Bearer/header for `POST /notifyRowSession` (row.dryl.io) |
| `PLANES_KIOSK_PLAY_URL` / `PLANES_KIOSK_PLAY_TOKEN` | Kitchen Kallax speaker trigger |
| `DEBUG_TOKEN_SECRET` | Debug endpoints (if enabled) |

Local / script testing: copy `.env.example` to `.env` in the repo root or `functions/.env` as documented in each script.

```bash
cp .env.example .env
# edit .env — never commit it
```

## Frontend (Angular PWA)

Some third-party keys are **visible in the browser** (weather, image search). Those should use domain restrictions and quotas on the provider side.

- OpenWeatherMap — weather layers
- Google Custom Search — aircraft images (where configured)

**Pushover application tokens and user keys must not ship in frontend code.** Registration posts the user key to planes-api over HTTPS; the API token stays on the server.

## If a secret is exposed

1. Rotate the credential at the provider (Pushover, etc.).
2. Update `/home/pi/planes-api/.env` on dryl-prod (or your local `.env` for dev).
3. Redeploy planes-api if needed: `python scripts/pi-install-planes-api.py`

## Historical note

Plane Alert previously used Firebase Cloud Functions + Firestore. That stack was removed; `lint:no-fcm-sw` blocks reintroducing Firebase messaging in the SPA. One-off migration scripts under `functions/scripts/` may still mention Firebase for **exporting old data only**.
