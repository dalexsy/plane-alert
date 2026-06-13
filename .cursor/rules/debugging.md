# Debugging notes — plane-alert

Agents: read this **before** retrying fixes. Append **Failed experiments** when something did not work so the next session does not repeat it.

Daryl maintains this solo — avoid burning cycles on approaches already ruled out.

**Shared infrastructure** (Directory hub, deploy scripts, ticket auto-fix, bug hunter, nginx): `directory/.cursor/rules/debugging.md` — do not duplicate that content here.

**For complex live/infra-heavy repos (e.g. balcony-log):** expand into per-**Symptom** deep-dive sections. See `balcony-log/.cursor/rules/debugging.md` as the pattern.

---

## Failed experiments (do not repeat)

<!-- Add dated bullets when a fix attempt fails, e.g.:
- **2026-06-02** — Do not … (symptom: …)
-->

_(none yet — add entries when something fails in production or deploy.)_

---

## Deploy & verify

- **Deploy:** `npm run deploy:dryl`
- **Pre-deploy:** `npm run verify:dist` _(when wired)_
- **Post-deploy:** `npm run verify:console` _(when wired)_
- **drylApi sites:** `node ../directory/scripts/verify-dryl-app.mjs https://<hostname> <site-id>`
- **How we work:** `.cursor/rules/ecosystem-health.mdc` — **Stack/UI:** `Repos/speculation/master-spec.md`

---

## Quick checks (customize for this repo)

Replace this table with symptoms **specific to plane-alert**. Fleet-generic checks belong in `directory/.cursor/rules/debugging.md`, not copied from other apps.

| Symptom | Likely cause | Command / fix |
|--------|----------------|---------------|
| Deploy log `[ok]` but app broken in browser | Smoke hit login redirect only | `npm run verify:console` |
| `custom-token` 503 / CORS | dryl-auth down or sites.json stale | Redeploy `dryl-auth`; re-run verify |
| Public 502 / 522 / 530 | Pi service, tunnel, or DNS | See directory debugging notes |

**After any failure:** append under a **Symptom** section (add one) or **Failed experiments** with date + what not to repeat.
