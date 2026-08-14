# Archive — plane-alert debugging history

> Agents: **do not load this file by default.** Primary playbook is `debugging.md` (≤200 lines).
> Compacted 2026-07-27 from a 109-line dump.

---

# Debugging notes — plane-alert

Agents: read this **before** retrying fixes. Append **Failed experiments** when something did not work so the next session does not repeat it.

Daryl maintains this solo — avoid burning cycles on approaches already ruled out.

**Shared infrastructure** (Directory hub, deploy scripts, ticket auto-fix, bug hunter, nginx): `directory/.cursor/rules/debugging.md` — do not duplicate that content here.

**For complex live/infra-heavy repos (e.g. balcony-log):** expand into per-**Symptom** deep-dive sections. See `balcony-log/.cursor/rules/debugging.md` as the pattern.

---

## Failed experiments (do not repeat)

- **2026-07-18** — Kiosk silent after `/v2/mil` merge: mil feed often lists in-range hexes **without lat/lon** (`inRange:0` while phones TTS from another map center). Do not return on the first upstream’s empty inRange — merge airplanes.live + adsb.lol; when still empty, ring-offset `/v2/point` fills. Broken snapshot `timestamp:{}` forced refetch that dropped cached mil — merge cache+fresh when `snapshotAgeMs===null`. Deliver `playKioskAlert` alone is not proof if natural mil never hit `Kiosk alert sound started`.
- **2026-07-18** — Kiosk silent while phones TTS for in-range mil: do **not** trust `/v2/point` alone. Near Berlin it returns ~20–30 nearest and drops mil at 60–90km that phones still show when their map center differs from the home pin. Journal: `kiosk-chime` refetches + `militaryFlagged:0` while other snapshots still had GAF/RCH. Merge `/v2/mil` filtered to radius into `chimeKioskForMilitaryInRange`. Snapshot `timestamp:{}`: `admin.firestore` is a **getter** returning a fresh namespace each access — LocalFieldValue `defineProperty` never sticks; write `Date.now()` for snapshot timestamps instead of `FieldValue.serverTimestamp()`.
- **2026-07-18** — Empty-list speaker events (morning ~11:06–12:38): journal attribution — **agent `sudo pw-play` / deploy-verify** of `tiny_little`/`precious_little` (many times), **not** natural `Kiosk alert sound started` (count 0). Real mil that morning: GAF650/RESQ87/GAF300 C-130J Hercules (would be mil on list). Do not invent Hercules/A400 false-positive product bugs without feed proof; do not seize Pi for speculative deploys.
- **2026-07-18** — Do **not** ship speculative empty-list alert “fixes” without a replicated trigger (ICAO + path + timestamp). Hercules/A400/localStorage seen-ICAO changes without proof those models were in air / that session wipe caused the event = bad engineering and burns Pi deploy lock for other agents. Stop, log attribution first (`[plane-alert] SPA MP3` / journal `Kiosk alert sound started`), then fix. Daryl: reboot chirp ≠ the bug; prove before code.
- **2026-07-18** — Kiosk silent after “newly-in-range” edge state (`6882043`): persisting ICAOs to `kiosk-chime-in-range-state.json` **before** pw-play exit 0 meant a failed/silent spawn never retried while the plane stayed in radius (same bug class as cooldown-before-success). Also do not drop ADS-B mil/dbFlags from the Pi gate after SPA `isMilitary` includes them (`1f63a14`) — phones alert, Pi stays quiet. Use SPA gate (db | prefix | ADS-B | special) + ICAO cooldown only after exit 0; delete stale edge-state file on deploy.
- **2026-07-18** — Empty-list / “nothing mil” SPA sounds: do **not** call reboot chirp the fix. Real gaps: (1) A380 model alert without mil; (2) Hercules/A400 model alerts without mil/special; (3) seen-ICAO seed in **sessionStorage** wiped by daytime kiosk restart Session Storage wipe → every in-air plane `isNew` again. Fix: alert only `isMilitary||special`; persist seen ICAOs in **localStorage**; log `[plane-alert] SPA MP3` with ICAOs.
- **2026-07-18** — Do **not** blame `planes-kiosk-daytime-restart` alone for empty-list mil alerts without checking seen-ICAO storage + model-only alerts. Restart wipes Session Storage (seen seed) — that re-alerts; chirp was a separate nuisance.
- **2026-07-18** — Kiosk sounded ~13:02 with nothing military: do **not** guess Pi PipeWire / ADS-B gate mismatch without journal. Proof: `planes-kiosk-daytime-restart.timer` (08:00/13:00/18:00/21:30) restarted Chromium at 13:00:38; ADS-B snapshot then had `milFieldTrue:0` `dbFlagsIs1:0`; **zero** `Kiosk alert sound started` all day. Cause was SPA **session chirp** (`playAlertSound` on boot). Fix: silent `unlockAlertAudio` only — never play the mil alert MP3 on kiosk boot/restart. Needs SPA ship; `deploy:fast` alone does not republish Chromium bundle.
- **2026-07-18** — Kiosk sounded with nothing military on the list (before and after noon): live speaker path may be SPA boot chirp **or** planes-api PipeWire. Do not remove ADS-B from Pi after SPA list marks ADS-B mil. Do not edge-persist in-range ICAOs before successful play.
- **2026-07-18** — Kiosk silent after attach-spawn + in-range chime verified (`pw-play` + `Kiosk alert sound started` on forced path): natural mil still missed because Pi gate used ADS-B `mil`/`dbFlags` + shared prefixes only, while phones use **aircraftDb.lookup(icao).mil** + `military-prefixes.json`. Also do not set ICAO play cooldown until pw-play **exit 0** — failed silent spawns blocked retries for 30min. Ship `military-aircraft-db.json` + SPA prefixes under planes-api `data/`.
- **2026-07-18** — Kiosk silent after SPA-parity in-range scan deployed (`3688272`): journal had `kiosk-chime` refetches and Pushover sends but **zero** `Kiosk alert sound started` on natural mil. Do not close on forced one-shot `pw-play` / TEST01 alone. `spawn(..., { detached: true, stdio: 'ignore' })` + `unref()` under systemd often never attaches to Jabra; keep child attached, pipe stderr, log non-zero exit. Keep deliver-path `playKioskAlert` as backup when notify succeeds.
- **2026-07-18** — Kiosk silent with chime only inside `collectMilitaryNotifications`: that path skips when Pushover device match is null, and **boring/ignored filters run before chime**, so phones SPA-TTS for db/prefix mil while magicmirror never reaches `playKioskAlertSound`. Scan homes once per processPlanes via `chimeKioskForMilitaryInRange` (SPA gate: db mil | prefix | special; no boring filter); do not require notify success.
- **2026-07-18** — Kiosk silent after “all military Pushover” chime: do not close on forced `TEST01` / `playKioskAlert=true` alone. Phones alert via SPA on first sighting; Pi chime gated on **successful Pushover after cooldown claim** misses the visit when (1) an earlier prefix-only gate skipped the chime, or (2) the plane stays in radius under 30min cooldown — journal shows `Notification sent` / `Aircraft in cooldown` with **zero** `Kiosk alert sound started`. Chime on **military/special in radius** (`military-in-range`) before the cooldown gate; keep ICAO play cooldown at 30min.
- **2026-07-18** — Noon refresh → alerts with empty mil list: do not treat cold-start `planeLog` as all-`isNew` without seeding. Soft reload + daytime Session Storage wipe both empty memory; seed seen ICAOs in **localStorage** (sessionStorage dies on kiosk restart wipe). Alert only mil/special (not model-only A380/hercules).
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
| p75 | 116s |
| p90 | 126s |
| Last deploy | 104s |
| Samples | 12 |

- **Agent shell wait:** use `block_until_ms` **153095** (~153s) — poll every 15s; do not pad to 15+ min upfront.
- **Fast read:** `.dryl-deploy-timing.json` in repo root mirrors this table.
- **Outliers:** stalls above ~2.5× median (or 10 min) are excluded from typical/p75 after enough samples.

Updated: 2026-07-27T07:50:16Z · source: `directory/data/deploy-timing.json`

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
| Audio for boring mil that never got Pushover | Call sites used different mil gates; SPA wrappers drifted from Pushover | One shared `shouldAlertForAircraft` — Pushover, kiosk, SPA MP3/TTS all call it |
| Kiosk sounds with nothing military/special on SPA list | Often SPA **session chirp** after `planes-kiosk-daytime-restart` (08:00/13:00/18:00/21:30) — not mil. Confirm: journal daytime-restart + `milFieldTrue:0`; Pi `Kiosk alert sound started` count | Silent unlock only on boot; never `playAlertSound()` for kiosk audio prime. Check journal before blaming Pi/ADS-B gates |
| Kiosk plays A400/Hercules then generic mil chime | SPA HTMLAudio + planes-api `pw-play` both owned the Jabra | Mute SPA MP3 on `?kiosk=1`; Pi picks one variant (hercules/iago/precious) |
| Kiosk re-chimes same mil every ~30min / feels like every cycle | Pi `chimeKioskForMilitaryInRange` called play every processPlanes (2min); 30min ICAO cooldown re-fired loiterers (journal `3F9B85` 13:20→13:52). Fix: visit-edge ack after play success; prune on leave | `deploy:pi-api`; journal `newVisits:0` while mil still in `icaos` |
| Kiosk silent for prefix-military (phones TTS OK) | Live SPA MP3 still DB-mil only; TTS skipped on kiosk; Pi gate missed aircraftDb mil; deliver-only chime misses cooldown visits; detached `pw-play` may spawn with no Jabra stream | planes-api chime on SPA gate (aircraftDb mil + SPA prefixes + special — not ADS-B alone); cooldown only after successful exit; non-detached spawn; SPA `plane.isMilitary` still needed on next SPA ship |
| Kiosk silent; phones TTS; `militaryFlagged:0` but mil within radius | `/v2/point` capped near dense hubs; mil feed often omits lat/lon; broken `timestamp:{}` refetch drops cached mil | Merge all `/v2/mil` upstreams + ring point fill when mil inRange=0; merge cache+fresh on null snapshot age; write `Date.now()` timestamps |
| TTS while PWA seems closed | `speechSynthesis` needs a live document — SW cannot speak (FCM = OS toast only). Background/unfocused open app is intentional. If truly no window, look for leftover Chrome/Edge Planes tab/PWA or misheard OS/Pushover toast | Do not mute on `visibilitychange` (breaks away-from-page alerts). Confirm no Planes process/window; check taskbar / chrome://apps |
| Watchdog left desktop visible | session-stale killed working Chromium; 5min cooldown; restart timed out at 35s | Fixed: session strikes, fast cooldown, 90s wait, quick-start skips blocking curl/session |
| Deploy log `[ok]` but app broken in browser | Smoke hit login redirect only | `npm run verify:console` |
| `custom-token` 503 / CORS | dryl-auth down or sites.json stale | Redeploy `dryl-auth`; re-run verify |
| Public 502 / 522 / 530 | Pi service, tunnel, or DNS | See directory debugging notes |
| CORS/`ERR_FAILED` flood to `cloudfunctions.net` on planes.dryl.io | Wrong bundle deployed (Firebase-era `feature/*` dist) or bypass deploy | Hard refresh; confirm `main-*.js` has no `cloudfunctions.net`; ship only `npm run deploy:dryl` from `main` after merge |
| Missing history panel / wrong scan UI ("Update now") | `main` diverged from `feature/notifications` | Merge feature branch to `main` — never robocopy worktree `dist/` to production |
| Same plane twice in one Pushover account inbox | Regression: per-device cooldown/send (`5cc5b90`, `userKey__device__icao`) after agents invented a missed-phone bug Daryl did not report | One API send per ICAO, `device=galaxys24,pixel10`, cooldown `userKey__ICAO`. Do not split send or cooldown per phone |
| Phone “missed” an alert while journal already shows one household `Sent Pushover` | Delivery on that handset (pin, volume, Pushover app) — not a second API claim | Do not restore per-device cooldown. That is how “twice of everything” comes back |
| Interesting military seen but no Pushover (`interestingMilitary:1`, `messagesToSend:0`, `checkAndMarkNotified transaction failed`) | Local JSON store facade: `LocalTransaction.delete` was missing; cooldown claimed then crashed when pruning same-path “legacy” docs for lowercase device names | Fixed in `local-firestore-refs.ts` + `notification-cooldown.ts`; redeploy with `npm run deploy:pi-api`. Production data is `/home/pi/planes-api/data/planes-api-store.json` — not Google Firestore |
| Logs mention `firebase-functions` / `admin.firestore` | Leftover API surface: Pi `pi-server.ts` uses `createLocalFirestore` + patches FieldValue; services still typed against firebase-admin | Not Cloud Firestore. Do not `admin.initializeApp()` / `admin.firestore()` on Pi — that path is legacy `functions/src/index.ts` only |
| Window view covers bottom of results list on phone | Results `max-height` was full viewport while window view is fixed 4rem at bottom (z-index higher) | Mobile `max-height: calc(100dvh - 5.5rem)` when window open; `.window-view-closed` restores full height. FAB: `body:has(.window-view-overlay) #dryl-corner-stack` lifts above strip |
| Bug hunter FAB overlaps window view | Corner stack `inset-block-end: 1rem` ignores window strip | Same `body:has(.window-view-overlay)` lift — FAB is intentional when signed in; do not remove |
| JOKER / CHX show fixed-wing map marker | Jul 12 heli ID split dropped callsign/type checks; `unknown-plane::before` overrode `toys_fan` | `isHelicopterByCallsign` + type/model patterns; CSS `unknown-plane:not(.copter-plane)` |
| Anonymous fetch of planes.dryl.io looks like admin | `planes` missing `"public": true` → nginx SSO → admin login HTML | Set `public: true` in `dryl-static-sites.json` + `pi-setup-dryl-host.py` |

**After any failure:** append under a **Symptom** section (add one) or **Failed experiments** with date + what not to repeat.

# Archive — plane-alert debugging history

> Agents: **do not load this file by default.** Primary playbook is `debugging.md` (≤200 lines).
> Compacted 2026-08-13 from a 93-line dump.

---

# Debugging notes — plane-alert

**Budget:** ≤200 lines. Symptoms + one-line failed experiments only.
**Not here:** session logs, multi-page post-mortems, ticket novels → `.cursor/rules/debugging-archive.md`
**Fleet rules:** `Repos/speculation/` only. **Infra:** Directory hub notes when this is not directory.

Agents: **read Symptom tables before retrying.** After a failed attempt, add **one line** under Failed experiments (date + do-not-repeat). If over budget, archive first.

---

## Triage (run first)

| Check | Command |
|-------|---------|
| Host / API | repo-specific (see package.json scripts) |
| Production | live URL + screenshot verify — not curl alone |
| Prior fails | Failed experiments below + archive if needed |

---

## Symptoms

| Symptom | Fix path | Do not |
|---------|----------|--------|
| Kiosk blank overnight / Chromium gone | `planes-kiosk.service` is **user** unit (`systemctl --user`); watch must resurrect via `chromium-missing`. Run `python scripts/pi-install-planes-kiosk.py --launch` | Treat `systemctl is-active planes-kiosk` (system bus) as truth — it is always inactive |
| SPA/kiosk “No planes worth peeping” while traffic exists | Proxy treated empty `adsb.lol` 200 as success (`airplanes.live` 403). Skip empty sources; add `opendata.adsb.fi`; OpenSky last-resort for **live map only**. Prove: `curl /api/planes/adsbPointProxy` then `PLANES IN THE SKY (n>0)` | Page-heal-only (heal is a no-op when ADS-B is also empty); treat `ac=[]` as healthy |

Keep each symptom to **this table or a short bullet list** (≤15 lines). Deep narrative → archive.

---

## Failed experiments (do not repeat)

- **2026-08-13** — Empty map with SPA up: do not treat HTTP 200 `{"ac":[]}` from adsb.lol as success; skip empty sources, add adsb.fi, OpenSky last-resort for live map only (not mil snapshots).
- **2026-08-12** — Kiosk empty/no recover: do not check/restart `127.0.0.1:8790` dryl-auth on magicmirror after Pi split (masked); do not require `session.jar` for ADS-B validity; do not install kiosk via `magicmirror_settings()` (.79).
- **2026-08-06** — Mobile results: `height:fit-content` + `max-height` only capped — flex body collapsed to ~18vh (~4 rows of 24). Expanded sheet needs **definite** `height: calc(100dvh - 5.5rem)`; assert body ≥62vh. Also: rails-only gates, `plus-lighter` bleed, seen `60vh`.
- **2026-08-06** — Do not gate `planes-kiosk-watch` on system `planes-kiosk.service` active/enabled: that unit is **user** systemd; system check always false → kill Chromium + block resurrection overnight. Yield/renice only under balcony pressure.
- **2026-08-05** — Kiosk “animations on” + window labels without chrome: force **effectiveAnimationsEnabled=false** on kiosk (do not leave product motion on). Window `.plane-label` must always have solid `rgba(0,0,0,0.9)` bg — `has-details` only at ≤10km left close-by planes (e.g. Voodoo ~11km) as bare text. Treat **mlat/unknown** as junk identity (not alert-worthy). Muted mil green use **0.7** not 0.5.
- **2026-07-31** — Kiosk CPU / infrastructure stall: do **not** blame plane-motion alone. Root was always-on paint: permanent tooltips with `backdrop-filter: blur`, per-marker `filter: drop-shadow`, dual left tooltips under swiftshader. Decorative RAF stays off; **2026-08-05** also forces product motion off on kiosk.
- **2026-07-27** — `npm test -- --watch=false` could not start because button/input specs had malformed `from (from)` imports and rain passed null to a string API; fix the test sources, never treat a green production build as unit-test proof
- **2026-07-18** — Kiosk silent after “newly-in-range” edge state (`6882043`): persisting ICAOs to `kiosk-chime-in-range-state.json` **before** pw-play exit 0 meant a failed/silent spawn never retried while the plane stayed in radius (same bug class as cooldown-before-success). A
- **2026-07-18** — Empty-list / “nothing mil” SPA sounds: do **not** call reboot chirp the fix. Real gaps: (1) A380 model alert without mil; (2) Hercules/A400 model alerts without mil/special; (3) seen-ICAO seed in **sessionStorage** wiped by daytime kiosk restart Session Storage
- **2026-07-18** — Do **not** blame `planes-kiosk-daytime-restart` alone for empty-list mil alerts without checking seen-ICAO storage + model-only alerts. Restart wipes Session Storage (seen seed) — that re-alerts; chirp was a separate nuisance.
- **2026-07-18** — Kiosk sounded ~13:02 with nothing military: do **not** guess Pi PipeWire / ADS-B gate mismatch without journal. Proof: `planes-kiosk-daytime-restart.timer` (08:00/13:00/18:00/21:30) restarted Chromium at 13:00:38; ADS-B snapshot then had `milFieldTrue:0` `dbFla
- **2026-07-18** — Kiosk sounded with nothing military on the list (before and after noon): live speaker path may be SPA boot chirp **or** planes-api PipeWire. Do not remove ADS-B from Pi after SPA list marks ADS-B mil. Do not edge-persist in-range ICAOs before successful play.
- **2026-07-18** — Kiosk silent after attach-spawn + in-range chime verified (`pw-play` + `Kiosk alert sound started` on forced path): natural mil still missed because Pi gate used ADS-B `mil`/`dbFlags` + shared prefixes only, while phones use **aircraftDb.lookup(icao).mil** + `m
- **2026-07-18** — Kiosk silent after SPA-parity in-range scan deployed (`3688272`): journal had `kiosk-chime` refetches and Pushover sends but **zero** `Kiosk alert sound started` on natural mil. Do not close on forced one-shot `pw-play` / TEST01 alone. `spawn(..., { detached: t
- **2026-07-18** — Kiosk silent with chime only inside `collectMilitaryNotifications`: that path skips when Pushover device match is null, and **boring/ignored filters run before chime**, so phones SPA-TTS for db/prefix mil while magicmirror never reaches `playKioskAlertSound`. S
- **2026-07-18** — Kiosk silent after “all military Pushover” chime: do not close on forced `TEST01` / `playKioskAlert=true` alone. Phones alert via SPA on first sighting; Pi chime gated on **successful Pushover after cooldown claim** misses the visit when (1) an earlier prefix-o
- **2026-07-18** — Noon refresh → alerts with empty mil list: do not treat cold-start `planeLog` as all-`isNew` without seeding. Soft reload + daytime Session Storage wipe both empty memory; seed seen ICAOs in **localStorage** (sessionStorage dies on kiosk restart wipe). Alert on
- **2026-07-18** — Kiosk silent while phones TTS: do not stop at `AUTO_FIX_FAIL: needs manual SPA deploy` after only shipping SPA prefix-military MP3. Live SPA still DB-mil gates kiosk MP3; bridge with **planes-api** `playKioskAlertSound` on prefix-only Pushover delivery (`deploy
- **2026-07-18** — Do not gate Pi kiosk chime on **prefix-only** (`prefixMil && !dbMil`). Prod Pushover traffic (GAF300, RESQ87, RCH…) almost always has `dbFlags=1`, so that gate never logged `Kiosk alert sound started` while phones still alerted. Chime on **every** military/spec
- **2026-07-18** — Do not ship kiosk quiet as **7am–10pm** (daytime mute). That silences magicmirror while phones still alert (`isKioskQuietHours` is kiosk-only) — matches “speaker OK, only kiosk silent”. Correct window is **22:00–07:00** Berlin (sleep). After flipping, `npm run
- **2026-07-18** — Kiosk MP3 alerts must use `plane.isMilitary` (DB **or** callsign prefix), not DB-mil alone. Phones still “make sound” via TTS for prefix-military; kiosk skips TTS, so DB-only MP3 checks look like “only the kiosk is silent”.
- **2026-07-18** — Do not early-return `playAudio` while another HTMLAudioElement is still playing. Session chirp (or any prior MP3) + one-shot `isNew` means the military plane alert is dropped forever on kiosk; phones still TTS. Interrupt the in-flight MP3 instead.
- **2026-08-05** — Ghost/wrong TTS (helicopters, mlat, closed PWA): **remove speechSynthesis** — keep MP3 alert sounds only. Do not try more focus/visibility gates; product decision is TTS off.
- **2026-07-17** — Superseded 2026-08-05: “only mute when fully closed / visibility OK for background alerts” caused ghost PWA speech. Kiosk still bypasses focus; phones/desktop need focus.
- **2026-07-15** — Mobile options/results “fixed” by only editing `input-overlay.component.scss` / `results-overlay.component.scss` max-height, then declaring done from smoke screenshots that **still showed the expanded sheet covering half the map**. **Root causes left live:** (1
- **2026-07-11** — Do not deploy `feature/notifications` (or any non-`main` worktree build) to production. Bundle `main-YKWORA5P.js` called `cloudfunctions.net` → CORS/`ERR_FAILED` flood; Pi only serves `/api/planes/*`. Do not bypass deploy QA (`--no-verify-client-errors`, direct
- **2026-07-04** — Do not keep Plane Alert on Firebase Blaze Cloud Functions for two users — scheduled `processPlanes` / `collectAircraftData` every 2 min caused ~$0.43/mo. **Pi backend** (`planes-api.service` on `:8795`, nginx `/api/planes/`) replaces all Cloud Functions; delete

Older entries: `.cursor/rules/debugging-archive.md` (read only when hunting a past failure).

---

## Deploy timing (auto)

Production deploy duration telemetry for **plane-alert** (successful deploys only; outliers trimmed after 5+ samples).

| Metric | Value |
|--------|-------|
| Typical (median) | 146s |
| p75 | 166s |
| p90 | 194s |
| Last deploy | 104s |
| Samples | 17 |

- **Agent shell wait:** use `block_until_ms` **120000** chunks (~120s), total budget **218692** (~219s) — poll / read deploy log between; never pad to 15+ min upfront.
- **Fast read:** `.dryl-deploy-timing.json` in repo root mirrors this table.
- **Outliers:** stalls above ~2.5× median (or 10 min) are excluded from typical/p75 after enough samples.

Updated: 2026-08-13T06:51:19Z · source: `directory/data/deploy-timing.json`

<!-- end deploy-timing -->

---

## Deploy & verify

- Local design: `npm run verify:localhost` when wired
- Ship: `npm run deploy:dryl` then wired `verify:console` / production PNG Read + QUOTE_VISIBLE
- drylApi: `node ../directory/scripts/verify-dryl-app.mjs https://<host> <site-id>`
- Mindset: `.cursor/rules/ecosystem-health.mdc` · stack: `Repos/speculation/master-spec.md`
