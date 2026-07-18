# Debugging notes — plane-alert

Agents: read this **before** retrying fixes. Append **Failed experiments** when something did not work so the next session does not repeat it.

Daryl maintains this solo — avoid burning cycles on approaches already ruled out.

**Shared infrastructure** (Directory hub, deploy scripts, ticket auto-fix, bug hunter, nginx): `directory/.cursor/rules/debugging.md` — do not duplicate that content here.

**For complex live/infra-heavy repos (e.g. balcony-log):** expand into per-**Symptom** deep-dive sections. See `balcony-log/.cursor/rules/debugging.md` as the pattern.

---

## Failed experiments (do not repeat)

- **2026-07-18** — Kiosk sounded ~13:02 with nothing military: do **not** guess Pi PipeWire / ADS-B gate mismatch without journal. Proof: `planes-kiosk-daytime-restart.timer` (08:00/13:00/18:00/21:30) restarted Chromium at 13:00:38; ADS-B snapshot then had `milFieldTrue:0` `dbFlagsIs1:0`; **zero** `Kiosk alert sound started` all day. Cause was SPA **session chirp** (`playAlertSound` on boot). Fix: silent `unlockAlertAudio` only — never play the mil alert MP3 on kiosk boot/restart.
- **2026-07-18** — Kiosk sounded with nothing military on the list (before and after noon): do **not** blame noon refresh alone. Live speaker path is often **planes-api PipeWire** (`chimeKioskForMilitaryInRange` / `military-in-range`), independent of the SPA list. Do not treat ADS-B `mil`/`dbFlags` as SPA-parity — SPA `isMilitary` is aircraftDb.mil OR callsign prefix OR special only; ADS-B-only made Pi chime for planes the list does not mark military. Also edge-trigger newly-in-range ICAOs (persist state) — re-chiming every loitering mil after cooldown looked like random empty-list alerts.
- **2026-07-18** — Kiosk silent after attach-spawn + in-range chime verified (`pw-play` + `Kiosk alert sound started` on forced path): natural mil still missed because Pi gate used ADS-B `mil`/`dbFlags` + shared prefixes only, while phones use **aircraftDb.lookup(icao).mil** + `military-prefixes.json`. Also do not set ICAO play cooldown until pw-play **exit 0** — failed silent spawns blocked retries for 30min. Ship `military-aircraft-db.json` + SPA prefixes under planes-api `data/`.
- **2026-07-18** — Kiosk silent after SPA-parity in-range scan deployed (`3688272`): journal had `kiosk-chime` refetches and Pushover sends but **zero** `Kiosk alert sound started` on natural mil. Do not close on forced one-shot `pw-play` / TEST01 alone. `spawn(..., { detached: true, stdio: 'ignore' })` + `unref()` under systemd often never attaches to Jabra; keep child attached, pipe stderr, log non-zero exit. Keep deliver-path `playKioskAlert` as backup when notify succeeds.
- **2026-07-18** — Kiosk silent with chime only inside `collectMilitaryNotifications`: that path skips when Pushover device match is null, and **boring/ignored filters run before chime**, so phones SPA-TTS for db/prefix mil while magicmirror never reaches `playKioskAlertSound`. Scan homes once per processPlanes via `chimeKioskForMilitaryInRange` (SPA gate: db mil | prefix | special; no boring filter); do not require notify success.
- **2026-07-18** — Kiosk silent after “all military Pushover” chime: do not close on forced `TEST01` / `playKioskAlert=true` alone. Phones alert via SPA on first sighting; Pi chime gated on **successful Pushover after cooldown claim** misses the visit when (1) an earlier prefix-only gate skipped the chime, or (2) the plane stays in radius under 30min cooldown — journal shows `Notification sent` / `Aircraft in cooldown` with **zero** `Kiosk alert sound started`. Chime on **military/special in radius** (`military-in-range`) before the cooldown gate; keep ICAO play cooldown at 30min.
- **2026-07-18** — Noon refresh → alerts with empty mil list: do not treat cold-start `planeLog` as all-`isNew` without seeding. Soft `?_refresh=` reload empties memory but keeps sessionStorage; every ICAO looked new and SPA MP3s fired (A380 luxury-liner / mil/special). Persist seen ICAOs in sessionStorage; skip session chirp on `_refresh` navigations. Removing A380 alert alone is not enough if mil/special are already in radius at reload.
- **2026-07-18** — Kiosk silent while phones TTS: do not stop at `AUTO_FIX_FAIL: needs manual SPA deploy` after only shipping SPA prefix-military MP3. Live SPA still DB-mil gates kiosk MP3; bridge with **planes-api** `playKioskAlertSound` on prefix-only Pushover delivery (`deploy:fast` + MP3 under `/home/pi/planes-api/assets/alerts/`, `XDG_RUNTIME_DIR` on the service). Keep SPA `plane.isMilitary` fix for when main is republished.
- **2026-07-18** — Do not gate Pi kiosk chime on **prefix-only** (`prefixMil && !dbMil`). Prod Pushover traffic (GAF300, RESQ87, RCH…) almost always has `dbFlags=1`, so that gate never logged `Kiosk alert sound started` while phones still alerted. Chime on **every** military/special Pushover delivery.
- **2026-07-18** — Do not ship kiosk quiet as **7am–10pm** (daytime mute). That silences magicmirror while phones still alert (`isKioskQuietHours` is kiosk-only) — matches “speaker OK, only kiosk silent”. Correct window is **22:00–07:00** Berlin (sleep). After flipping, `npm run kiosk:restart` so Chromium drops the daytime-mute bundle. **Prod verify:** within ~5s of restart (outside quiet hours) `wpctl status` must show Chromium output → Jabra (session chirp); do not close on SPA hash alone. Restart must wipe Chromium `Session Storage` or a restored `kiosk-audio-primed` skips the chirp after SIGKILL.
- **2026-07-18** — Kiosk MP3 alerts must use `plane.isMilitary` (DB **or** callsign prefix), not DB-mil alone. Phones still “make sound” via TTS for prefix-military; kiosk skips TTS, so DB-only MP3 checks look like “only the kiosk is silent”.
- **2026-07-18** — Do not early-return `playAudio` while another HTMLAudioElement is still playing. Session chirp (or any prior MP3) + one-shot `isNew` means the military plane alert is dropped forever on kiosk; phones still TTS. Interrupt the in-flight MP3 instead.
- **2026-07-17** — Do not mute TTS/MP3 on `document.visibilityState !== 'visible'`. Product wants alerts while the open PWA/tab is in the background; only a fully closed window should be silent (browser already enforces that — no document ⇒ no `speechSynthesis`). Visibility mute shipped then reverted same day.
- **2026-07-15** — Mobile options/results “fixed” by only editing `input-overlay.component.scss` / `results-overlay.component.scss` max-height, then declaring done from smoke screenshots that **still showed the expanded sheet covering half the map**. **Root causes left live:** (1) `ui/tab/tab.component.scss` mobile-first `height: calc(100vh - 0.5rem)` on `.top-buttons.left` (from “full page input on mobile” 20899bf) — `app-tab` is encapsulated, parent max-height does **not** shrink the rail; (2) `ui/input` mobile-first `height: 100%` + `padding: 1rem 1.25rem` made the address field full-page sized; (3) `settings.load()` reapplied localStorage expanded state **after** constructor mobile collapse; (4) verification gates treated “Search Radius visible” as pass — **wrong**. **Must pass:** mobile expanded options leaves **≥ half the map** visible under the sheet; left icon rail is content-height not 100vh; Read production mobile PNG with options **expanded**. Layout is SCSS (flex + rem max-height), not TS geometry.
- **2026-07-11** — Do not deploy `feature/notifications` (or any non-`main` worktree build) to production. Bundle `main-YKWORA5P.js` called `cloudfunctions.net` → CORS/`ERR_FAILED` flood; Pi only serves `/api/planes/*`. Do not bypass deploy QA (`--no-verify-client-errors`, direct `pi-deploy`, `robocopy` into `dist/`). Ship only `npm run deploy:dryl` from `main` after merge. Correct UI lives on `feature/notifications` — merge to `main` first, never upload side-tree dist.
- **2026-07-04** — Do not keep Plane Alert on Firebase Blaze Cloud Functions for two users — scheduled `processPlanes` / `collectAircraftData` every 2 min caused ~$0.43/mo. **Pi backend** (`planes-api.service` on `:8795`, nginx `/api/planes/`) replaces all Cloud Functions; delete Firebase functions and downgrade project to Spark.

---

## Deploy timing (auto)

Production deploy duration telemetry for **plane-alert** (successful deploys only; outliers trimmed after 5+ samples).

| Metric | Value |
|--------|-------|
| Typical (median) | 111s |
| p75 | 115s |
| p90 | 126s |
| Last deploy | 99s |
| Samples | 8 |

- **Agent shell wait:** use `block_until_ms` **153095** (~153s) — poll every 15s; do not pad to 15+ min upfront.
- **Fast read:** `.dryl-deploy-timing.json` in repo root mirrors this table.
- **Outliers:** stalls above ~2.5× median (or 10 min) are excluded from typical/p75 after enough samples.

Updated: 2026-07-18T10:05:24Z · source: `directory/data/deploy-timing.json`

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
| Kiosk basemap tiles flash / full-map refresh every ~30–60s (daylight) | `MapThemeService` rebuilt Esri layers on every `brightness$` tick, not only day↔night | Only swap tiles when mode changes; do not re-`initializeWithMap` after boot |
| Kiosk quiet 10pm–7am Berlin (MP3 alerts daytime) | Sleep hours silence on magicmirror | `isKioskQuietHours()` overnight window; session chirp skipped then; `testAlertSound()` bypasses |
| Kiosk sounds with nothing military/special on SPA list | Often SPA **session chirp** after `planes-kiosk-daytime-restart` (08:00/13:00/18:00/21:30) — not mil. Confirm: journal daytime-restart + `milFieldTrue:0`; Pi `Kiosk alert sound started` count | Silent unlock only on boot; never `playAlertSound()` for kiosk audio prime. Check journal before blaming Pi/ADS-B gates |
| Kiosk silent for prefix-military (phones TTS OK) | Live SPA MP3 still DB-mil only; TTS skipped on kiosk; Pi gate missed aircraftDb mil; deliver-only chime misses cooldown visits; detached `pw-play` may spawn with no Jabra stream | planes-api chime on SPA gate (aircraftDb mil + SPA prefixes + special — not ADS-B alone); cooldown only after successful exit; non-detached spawn; SPA `plane.isMilitary` still needed on next SPA ship |
| TTS while PWA seems closed | `speechSynthesis` needs a live document — SW cannot speak (FCM = OS toast only). Background/unfocused open app is intentional. If truly no window, look for leftover Chrome/Edge Planes tab/PWA or misheard OS/Pushover toast | Do not mute on `visibilitychange` (breaks away-from-page alerts). Confirm no Planes process/window; check taskbar / chrome://apps |
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
