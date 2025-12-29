# Repo Structure Audit (PlaneAlert)

Date: 2025-12-29

## Why this exists

The repo is already a small monorepo (Angular PWA + Node dev proxy + Firebase functions + a shared TS package). It _can_ scale cleanly, but right now there’s visible script sprawl at the root (one-off debug/test utilities mixed with real entrypoints).

This document is an audit + a safe, incremental cleanup plan that avoids breaking existing workflows.

## What the user expects (BDD framing)

- The app should behave consistently across sessions (e.g., changing the saved location should change results to that location).
- The codebase should be easy to evolve without turning the root directory into a dumping ground.

## Current structure (high-level)

- `src/` — Angular PWA
- `server.js` — Node dev proxy server (used by `npm start`)
- `functions/` — Firebase Cloud Functions backend
- `shared/` — Shared TS package consumed by frontend + backend (`@plane-alert/shared`)
- `scripts/` — build/deploy/data scripts referenced from `package.json`
- Root-level `*.js` / `test-*.js` / `check-*.js` — appears to be a mixture of:
  - one-off debug utilities
  - ad-hoc test runners
  - maintenance tools

## What’s “production-critical” vs “tooling”

Based on `package.json` + `README.md`:

- Production/dev entrypoints:
  - `server.js` (via `npm start` and `npm run server`)
  - `scripts/*` (build, deploy, sync)
  - `functions/*`, `shared/*`, `src/*`
- Likely tooling/debug (not referenced by npm scripts; names suggest one-off usage):
  - `check-*.js`, `debug-*.js`, `verify-*.js`, `send-test-notification.js`
  - `test-*.js` at repo root
  - `update-galaxy-*.js/.py` (unclear whether still active)

## Recommended target layout (incremental, low risk)

Instead of a huge reorg, do this in layers:

### Layer 1 (no breaking changes): “tool quarantine”

- Create a dedicated folder for one-off utilities:
  - `tools/` (or `dev-tools/`)
- Keep the root scripts working by leaving _tiny wrapper files_ at the root that forward to `tools/...`.
  - This preserves existing muscle-memory commands like `node test-notification-title.js`.

Suggested structure:

- `tools/adhoc-tests/` — root `test-*.js`
- `tools/debug/` — `debug-*`, `verify-*`, `check-*`
- `tools/ops/` — `send-test-notification.js`, device check scripts
- `tools/galaxy/` — `update-galaxy-*` utilities (if still used)

### Layer 2: Make tooling discoverable

- Add `tools/README.md` listing:
  - purpose
  - usage
  - whether it’s still needed
- Optionally add npm scripts for the _important_ tools (only the ones you actually use).

### Layer 3: Enforce “no new root scripts”

- Add a simple convention:
  - Only these file types live at repo root: config files + entrypoints (`server.js`) + docs
  - Everything else goes under `scripts/` (build/deploy) or `tools/` (debug/admin)

## Proposed cleanup steps I can do next (pick one)

1. **Audit-only pass (safe):** categorize every root script into “keep/move/delete”, and generate a checklist.
2. **Minimal reorg (safe-ish):** create `tools/` and move root scripts into it, leaving wrappers at the old paths.
3. **Bigger reorg (breaking if not careful):** adopt an `apps/` + `packages/` layout and update paths across deploy scripts.

If you tell me which option you want, I’ll execute it end-to-end.
