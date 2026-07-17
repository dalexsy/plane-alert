# Debugging notes — plane-alert

Agents: read this **before** retrying fixes. Append **Failed experiments** when something did not work so the next session does not repeat it.

Daryl maintains this solo — avoid burning cycles on approaches already ruled out.

**Shared infrastructure** (Directory hub, deploy scripts, ticket auto-fix, bug hunter, nginx): `directory/.cursor/rules/debugging.md` — do not duplicate that content here.

**For complex live/infra-heavy repos (e.g. balcony-log):** expand into per-**Symptom** deep-dive sections. See `balcony-log/.cursor/rules/debugging.md` as the pattern.

---

## Failed experiments (do not repeat)

- **2026-07-15** — Mobile options/results “fixed” by only editing `input-overlay.component.scss` / `results-overlay.component.scss` max-height, then declaring done from smoke screenshots that **still showed the expanded sheet covering half the map**. **Root causes left live:** (1) `ui/tab/tab.component.scss` mobile-first `height: calc(100vh - 0.5rem)` on `.top-buttons.left` (from “full page input on mobile” 20899bf) — `app-tab` is encapsulated, parent max-height does **not** shrink the rail; (2) `ui/input` mobile-first `height: 100%` + `padding: 1rem 1.25rem` made the address field full-page sized; (3) `settings.load()` reapplied localStorage expanded state **after** constructor mobile collapse; (4) verification gates treated “Search Radius visible” as pass — **wrong**. **Must pass:** mobile expanded options leaves **≥ half the map** visible under the sheet; left icon rail is content-height not 100vh; Read production mobile PNG with options **expanded**. Layout is SCSS (flex + rem max-height), not TS geometry.
- **2026-07-11** — Do not deploy `feature/notifications` (or any non-`main` worktree build) to production. Bundle `main-YKWORA5P.js` called `cloudfunctions.net` → CORS/`ERR_FAILED` flood; Pi only serves `/api/planes/*`. Do not bypass deploy QA (`--no-verify-client-errors`, direct `pi-deploy`, `robocopy` into `dist/`). Ship only `npm run deploy:dryl` from `main` after merge. Correct UI lives on `feature/notifications` — merge to `main` first, never upload side-tree dist.
- **2026-07-04** — Do not keep Plane Alert on Firebase Blaze Cloud Functions for two users — scheduled `processPlanes` / `collectAircraftData` every 2 min caused ~$0.43/mo. **Pi backend** (`planes-api.service` on `:8795`, nginx `/api/planes/`) replaces all Cloud Functions; delete Firebase functions and downgrade project to Spark.

---

## Deploy timing (auto)

Production deploy duration telemetry for **plane-alert** (successful deploys only; outliers trimmed after 5+ samples).

| Metric | Value |
|--------|-------|
| Typical (median) | 150s |
| p75 | 233s |
| p90 | 849s |
| Last deploy | 849s |
| Samples | 4 |

- **Agent shell wait:** use `block_until_ms` **299130** (~299s) — poll every 15s; do not pad to 15+ min upfront.
- **Fast read:** `.dryl-deploy-timing.json` in repo root mirrors this table.
- **Outliers:** stalls above ~2.5× median (or 10 min) are excluded from typical/p75 after enough samples.

Updated: 2026-07-17T09:36:26Z · source: `directory/data/deploy-timing.json`

<!-- end deploy-timing -->

---

## Deploy & verify

- **Deploy:** `npm run deploy:dryl`
- **Pi push/ADS-B API (no Firebase bill):** `npm run deploy:pi-api`
- **Kiosk install/restart:** `npm run kiosk:planes` / `npm run kiosk:restart`
- **Pre-deploy:** `npm run verify:dist` _(when wired)_
- **Post-deploy:** `npm run verify:console` _(when wired)_
- **drylApi sites:** `node ../directory/scripts/verify-dryl-app.mjs https://<hostname> <site-id>`
- **How we work:** `.cursor/rules/ecosystem-health.mdc` — **Stack/UI:** `Repos/speculation/master-spec.md`

---

## Quick checks (customize for this repo)

Replace this table with symptoms **specific to plane-alert**. Fleet-generic checks belong in `directory/.cursor/rules/debugging.md`, not copied from other apps.

| Symptom | Likely cause | Command / fix |
|--------|----------------|---------------|
| White screen after noon refresh | Service worker cached stale `index.html` | Fixed in `public/sw.js` + `NoonRefreshService` unregisters SW before reload |
| Kiosk stuck on admin.dryl.io / login | SSO sent admins to apps hub; kiosk opened login URL | `dryl-auth` login guard uses `/api/auth/next`; kiosk always starts at `planes.dryl.io` |
| Kiosk SSO login despite credentials.env | Stale `session.jar` token reused after auth secret/redeploy; login-json Set-Cookie from 127.0.0.1 ignored | `planes-kiosk-session.py` clears jar + reads Set-Cookie only; `npm run kiosk:planes` |
| Kiosk blank map + “refreshing often” after boot | User service starts before wayland → Chromium dies; desktop autostart then holds lock while `Restart=on-failure` spam-exits every 20s; map looks blank while tiles load after real restart | Wait for wayland socket; flock exit 0 if already running; desktop only `systemctl --user start`; `npm run kiosk:planes` |
| Kiosk silent alerts (speaker OK; works in desktop browsers) | Chromium blocks media/TTS without a user gesture; kiosk never clicks. TTS also gated on `userUnlocked` | `--autoplay-policy=no-user-gesture-required` in `planes-kiosk.sh`; kiosk unlocks TTS + `unlockAlertAudio()`; `npm run kiosk:planes` + deploy |
| Watchdog left desktop visible | session-stale killed working Chromium; 5min cooldown; restart timed out at 35s | Fixed: session strikes, fast cooldown, 90s wait, quick-start skips blocking curl/session |
| Deploy log `[ok]` but app broken in browser | Smoke hit login redirect only | `npm run verify:console` |
| `custom-token` 503 / CORS | dryl-auth down or sites.json stale | Redeploy `dryl-auth`; re-run verify |
| Public 502 / 522 / 530 | Pi service, tunnel, or DNS | See directory debugging notes |
| CORS/`ERR_FAILED` flood to `cloudfunctions.net` on planes.dryl.io | Wrong bundle deployed (Firebase-era `feature/*` dist) or bypass deploy | Hard refresh; confirm `main-*.js` has no `cloudfunctions.net`; ship only `npm run deploy:dryl` from `main` after merge |
| Missing history panel / wrong scan UI ("Update now") | `main` diverged from `feature/notifications` | Merge feature branch to `main` — never robocopy worktree `dist/` to production |
| One phone gets Pushover alert, other misses same plane | Shared Pushover user key + per-device store rows + account-level cooldown (`userKey__icao`) — first device wins, second skipped | Per-device cooldown keys (`userKey__device__icao`) are the intended fix; do not reintroduce Cloud Firestore. If still one-sided, check Pi journal for `Aircraft in cooldown, skipping` |
| Chris says no alerts while Pi logs `Sent Pushover` for both `galaxys24` + `pixel10` | Not a filter miss — API accepted both. Common: `sound: none` (easy to miss), wrong home pin (galaxys24 stuck at BER), phone battery killing Pushover, or legacy `userKey__icao` cooldowns | Use audible `pushover` sound; confirm journal has `deviceName` on Sent lines; reset home to Wuhlheide; prune 2-segment cooldown ids; send titled test to each device |
| Interesting military seen but no Pushover (`interestingMilitary:1`, `messagesToSend:0`, `checkAndMarkNotified transaction failed`) | Local JSON store facade: `LocalTransaction.delete` was missing; cooldown claimed then crashed when pruning same-path “legacy” docs for lowercase device names | Fixed in `local-firestore-refs.ts` + `notification-cooldown.ts`; redeploy with `npm run deploy:pi-api`. Production data is `/home/pi/planes-api/data/planes-api-store.json` — not Google Firestore |
| Logs mention `firebase-functions` / `admin.firestore` | Leftover API surface: Pi `pi-server.ts` uses `createLocalFirestore` + patches FieldValue; services still typed against firebase-admin | Not Cloud Firestore. Do not `admin.initializeApp()` / `admin.firestore()` on Pi — that path is legacy `functions/src/index.ts` only |
| Window view covers bottom of results list on phone | Results `max-height` was full viewport while window view is fixed 4rem at bottom (z-index higher) | Mobile `max-height: calc(100dvh - 5.5rem)` when window open; `.window-view-closed` restores full height. FAB: `body:has(.window-view-overlay) #dryl-corner-stack` lifts above strip |
| Bug hunter FAB overlaps window view | Corner stack `inset-block-end: 1rem` ignores window strip | Same `body:has(.window-view-overlay)` lift — FAB is intentional when signed in; do not remove |
| JOKER / CHX show fixed-wing map marker | Jul 12 heli ID split dropped callsign/type checks; `unknown-plane::before` overrode `toys_fan` | `isHelicopterByCallsign` + type/model patterns; CSS `unknown-plane:not(.copter-plane)` |
| Anonymous fetch of planes.dryl.io looks like admin | `planes` missing `"public": true` → nginx SSO → admin login HTML | Set `public: true` in `dryl-static-sites.json` + `pi-setup-dryl-host.py` |

**After any failure:** append under a **Symptom** section (add one) or **Failed experiments** with date + what not to repeat.
