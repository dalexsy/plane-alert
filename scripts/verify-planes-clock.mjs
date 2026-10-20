#!/usr/bin/env node
/**
 * Live proof: map clock uses 24-hour Europe/Berlin time (not AM-stripped 12-hour).
 *
 *   node scripts/verify-planes-clock.mjs https://planes.staging.dryl.io/
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const directoryRoot = join(repoRoot, "..", "directory");
const require = createRequire(join(directoryRoot, "package.json"));
const pw = require("playwright-core");
const launchMod = pathToFileURL(
  join(directoryRoot, "scripts", "lib", "playwright-smoke-launch.mjs"),
);
const { launchSmokeBrowser } = await import(launchMod.href);

const url = (process.argv[2] ?? "https://planes.dryl.io/").replace(/\/?$/, "/");
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function expectedBerlinHHMM(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(now);
}

const browser = await launchSmokeBrowser(pw.chromium);
const page = await browser.newPage();
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate(() => {
    localStorage.setItem("showDateTimeOverlay", "true");
  });
  await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
  const clock = page.locator("app-clock .time-overlay");
  await clock.waitFor({ state: "visible", timeout: 60_000 });
  const shown = (await clock.innerText()).trim();
  const expected = expectedBerlinHHMM();

  if (!TIME_RE.test(shown)) {
    console.error(`[fail] clock "${shown}" is not 24-hour HH:MM`);
    process.exit(1);
  }
  if (/am|pm/i.test(shown)) {
    console.error(`[fail] clock still contains AM/PM: "${shown}"`);
    process.exit(1);
  }
  if (shown !== expected) {
    console.error(
      `[fail] clock "${shown}" ≠ Europe/Berlin ${expected} (AM/PM strip bug shows ~12h offset)`,
    );
    process.exit(1);
  }

  console.log(`[ok] planes clock ${shown} (24-hour Europe/Berlin, matches wall time)`);
  console.log(`[agent-required] QUOTE_VISIBLE: planes clock — ${shown} (24h Berlin)`);
} finally {
  await browser.close();
}
