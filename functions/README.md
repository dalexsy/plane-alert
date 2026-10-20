# planes-api (`functions/`)

Source for **planes-api**: Node/Express on dryl-prod, persisted in a **local JSON file** (`PLANES_API_STORE_PATH`). The folder name `functions/` is historical (this is not deployed to Firebase).

## Run locally

```bash
cd functions
npm install
npm run build
npm run start:pi
```

Default listen: `127.0.0.1:8795`. Use `.env` for `PUSHOVER_API_TOKEN`, store path, and feature flags.

## Deploy

From the plane-alert repo root:

```bash
python scripts/pi-install-planes-api.py
```

Nginx on dryl-prod proxies `https://planes.dryl.io/api/planes/*` to this service.

## Entry points

| File | Role |
|------|------|
| `src/pi-server.ts` | Production HTTP server + cron |
| `src/index.ts` | Empty stub (legacy Cloud Functions entry disabled) |

Shared aircraft logic: `@plane-alert/shared` (built into `shared-package/` for this package).

## Legacy Firebase tooling

`scripts/export-device-tokens.cjs` was a **one-time** Firestore export when migrating to the Pi JSON store. Do not use it for normal operations; new installs do not need Firebase credentials.
