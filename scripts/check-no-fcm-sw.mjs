import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  "firebase",
  "gstatic.com/firebasejs",
  "plane-alert-800ff",
  "firebase-messaging",
];
const forbiddenRe = new RegExp(forbidden.map(escapeRegExp).join("|"), "i");

const targets = [
  path.join(repoRoot, "public", "sw.js"),
  path.join(repoRoot, "dist", "plane-alert", "browser", "sw.js"),
  path.join(repoRoot, "src", "main.ts"),
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hits(content) {
  return [...content.matchAll(new RegExp(forbiddenRe, "gi"))].map((m) => m[0]);
}

const failures = [];
let checked = 0;

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  checked += 1;
  const content = fs.readFileSync(file, "utf8");
  const found = hits(content);
  if (found.length) {
    failures.push(`${path.relative(repoRoot, file)}: ${[...new Set(found)].join(", ")}`);
  }
}

const registerPath = path.join(repoRoot, "src", "main.ts");
if (fs.existsSync(registerPath)) {
  const main = fs.readFileSync(registerPath, "utf8");
  if (/\.register\s*\(\s*['"`]\/sw\.js['"`]/.test(main)) {
    failures.push("src/main.ts still registers /sw.js (FCM leftover; do not re-register)");
  }
}

if (!checked) {
  console.error("[fail] no sw.js or register() path to grep");
  process.exit(1);
}

if (failures.length) {
  console.error("[fail] shipped sw.js / register() path must not mention firebase:");
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log("[ok] sw.js and register() path have no firebase");
