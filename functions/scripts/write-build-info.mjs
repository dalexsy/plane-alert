#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(__dirname, "..");
const repoRoot = join(functionsDir, "..");

function git(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const sha = git("git rev-parse HEAD");
const payload = {
  service: "planes-api",
  version: String(pkg.version || "0.0.0"),
  gitSha: sha,
  gitShaShort: sha.slice(0, 12),
  builtAt: new Date().toISOString(),
  branch: git("git rev-parse --abbrev-ref HEAD"),
};

for (const out of [
  join(functionsDir, "build-info.json"),
  join(functionsDir, "lib", "build-info.json"),
]) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(
  `[ok] planes-api build-info ${payload.version} @ ${payload.gitShaShort}`,
);
