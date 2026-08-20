#!/usr/bin/env node
/**
 * Directory maintain/probe entry for the planes-api .env preserve gate.
 *
 * Hang from directory:
 *   errors:probe:refresh
 *   errors:maintain
 * via `npm --prefix ../plane-alert run verify:planes-api-env`
 * and `npm --prefix ../plane-alert run verify:kiosk-alert`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "python3",
  [path.join(repoRoot, "scripts/probe-planes-api-env.py")],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
