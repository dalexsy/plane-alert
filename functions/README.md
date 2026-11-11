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

The live planes API is Go and ships with `fleetctl release-go`.

Nginx on dryl-prod proxies `https://planes.dryl.io/api/planes/*` to this service.

## Entry points

| File | Role |
|------|------|
| `src/pi-server.ts` | Production HTTP server + cron |
| `src/index.ts` | Empty stub (legacy Cloud Functions entry disabled) |

Shared aircraft logic: `@plane-alert/shared` (built into `shared-package/` for this package).

## Legacy Firebase tooling

The one-time Firestore device-token export was removed with the old Pi Python installer. New installs do not need Firebase credentials.
