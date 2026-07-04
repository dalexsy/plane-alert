# Debugging notes — plane-alert

Agents: read this **before** retrying fixes. Append **Failed experiments** when something did not work so the next session does not repeat it.

Daryl maintains this solo — avoid burning cycles on approaches already ruled out.

**Shared infrastructure** (Directory hub, deploy scripts, ticket auto-fix, bug hunter, nginx): `directory/.cursor/rules/debugging.md` — do not duplicate that content here.

**For complex live/infra-heavy repos (e.g. balcony-log):** expand into per-**Symptom** deep-dive sections. See `balcony-log/.cursor/rules/debugging.md` as the pattern.

---

## Push notifications (Pushover)

**Mental model (like Slack/email on multiple devices):** one Firestore registration per **Pushover device name** (`pixel10`, `galaxys24`, `desktop`, …). Each registration has its **own** location, radius, ignored types, and proximity flag. When an interesting plane is in range for that registration, we send **one** Pushover message with `device=<that name>` — only that physical device receives it.

Shared Pushover user key (household / family account) is fine: `pixel10` and `galaxys24` are still **separate recipients**. Cooldown is **`userKey + deviceName + ICAO`**, not `userKey + ICAO` alone — one person getting an alert must not suppress another's phone.

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Same phone gets **two** alerts for one plane | Duplicate Firestore rows for the same Pushover device (e.g. two `pixel10` docs) | `dedupeDeviceRegistrationsByPushoverTarget` before notify; do not delete registrations mid-run |
| **All** phones buzz for every registration | Unmatched device fell through to Pushover **broadcast** (`device` param omitted) | Must **skip** unmatched rows (`resolvePushoverDeviceName` → null). Never broadcast unless `PUSHOVER_BROADCAST_ALL_DEVICES=true` |
| Second phone never gets alerts | Account-wide cooldown (`userKey__ICAO`) or only one registration processed | Per-device cooldown; one registration per Pushover device on the account |
| Boring military alerts | Filter bypass / missing type | `isBoringMilitaryAircraft`; ticket cluster `planes:push-boring` |
| Missing interesting military | Callsign-only tracks dropped | `isMilitaryCallsign`; cluster `planes:push-missing` |

**Verify in production:** `directory/scripts/lib/errors-probe-plane-notifications.mjs` — clusters `planes:push-dedup`, `planes:push-boring`, `planes:push-missing`. `firebase functions:log --only processPlanes`.

**Failed experiments (do not repeat):**

- **2026-06-20** — `dedupeToOneRegistrationPerUser` dropped second phones on shared Pushover keys (report cd174dd7 follow-up / 18f23844).
- **2026-06-20..24** — Account-wide cooldown (`userKey + ICAO`) made `galaxys24` claim alerts before `pixel10` ran.
- **2026-06-24** — Auto-sync that kept only one mobile registration per account — wrong for multi-human households.
- **2026-06-19** — Broadcast fallback when Pushover device match failed (`device` param empty → all account devices notified, often **plus** other registrations still running → global duplicates). Fixed: skip unmatched registrations.

---

## Failed experiments (do not repeat)

<!-- Add dated bullets when a fix attempt fails, e.g.:
- **2026-06-02** — Do not … (symptom: …)
-->

_(See Push notifications section above for notification-specific failures.)_

---

## Deploy & verify

- **Deploy:** `npm run deploy:dryl`
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
| Kiosk flickers / kills browser every ~6 min on ADS-B Exchange | `runaway-renderer-cpu` at 45% threshold; globe WebGL ~150% on Pi | Raised `CPU_HIGH` to 220, 6 strikes; stop restarting for `wrong-url-not-planes` |
| Deploy log `[ok]` but app broken in browser | Smoke hit login redirect only | `npm run verify:console` |
| `custom-token` 503 / CORS | dryl-auth down or sites.json stale | Redeploy `dryl-auth`; re-run verify |
| Public 502 / 522 / 530 | Pi service, tunnel, or DNS | See directory debugging notes |

**After any failure:** append under a **Symptom** section (add one) or **Failed experiments** with date + what not to repeat.
