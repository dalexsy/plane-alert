import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repoRoot, "src", "app");
const allowedCallers = new Set([
  path.join(appRoot, "app.component.ts"),
  path.join(appRoot, "services", "notification", "notification.service.ts"),
]);

function typescriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

const automaticCallers = typescriptFiles(appRoot).filter((file) => {
  if (allowedCallers.has(file)) return false;
  return fs.readFileSync(file, "utf8").includes("showMilitaryPlaneNotification");
});

if (automaticCallers.length) {
  console.error(
    "[fail] browser notifications must remain test-only; Pushover owns automatic aircraft delivery:",
  );
  for (const file of automaticCallers) {
    console.error(`  ${path.relative(repoRoot, file)}`);
  }
  process.exit(1);
}

console.log(
  "[ok] notification delivery has one automatic owner (server-side Pushover)",
);
