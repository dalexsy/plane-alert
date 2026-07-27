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
| _(add rows as real production fails appear)_ | | |

Keep each symptom to **this table or a short bullet list** (≤15 lines). Deep narrative → archive.

---

## Failed experiments (do not repeat)

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
- **2026-07-17** — Do not mute TTS/MP3 on `document.visibilityState !== 'visible'`. Product wants alerts while the open PWA/tab is in the background; only a fully closed window should be silent (browser already enforces that — no document ⇒ no `speechSynthesis`). Visibility mute
- **2026-07-15** — Mobile options/results “fixed” by only editing `input-overlay.component.scss` / `results-overlay.component.scss` max-height, then declaring done from smoke screenshots that **still showed the expanded sheet covering half the map**. **Root causes left live:** (1
- **2026-07-11** — Do not deploy `feature/notifications` (or any non-`main` worktree build) to production. Bundle `main-YKWORA5P.js` called `cloudfunctions.net` → CORS/`ERR_FAILED` flood; Pi only serves `/api/planes/*`. Do not bypass deploy QA (`--no-verify-client-errors`, direct
- **2026-07-04** — Do not keep Plane Alert on Firebase Blaze Cloud Functions for two users — scheduled `processPlanes` / `collectAircraftData` every 2 min caused ~$0.43/mo. **Pi backend** (`planes-api.service` on `:8795`, nginx `/api/planes/`) replaces all Cloud Functions; delete

Older entries: `.cursor/rules/debugging-archive.md` (read only when hunting a past failure).

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

- Local design: `npm run verify:localhost` when wired
- Ship: `npm run deploy:dryl` then wired `verify:console` / production PNG Read + QUOTE_VISIBLE
- drylApi: `node ../directory/scripts/verify-dryl-app.mjs https://<host> <site-id>`
- Mindset: `.cursor/rules/ecosystem-health.mdc` · stack: `Repos/speculation/master-spec.md`
