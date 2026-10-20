#!/usr/bin/env node
/**
 * Preview Pushover title/body via buildMilitaryPendingNotification — no API send.
 * Run after: npm run build --prefix functions
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.PLANES_API_PUSHOVER_ENABLED = "0";
process.env.DRYL_ENV = "staging";

const require = createRequire(import.meta.url);
const { buildMilitaryPendingNotification } = require("../lib/services/build-military-notification.js");
const { isPushoverSendEnabled } = require("../lib/services/pushover-send-gate.js");

assert.equal(isPushoverSendEnabled(), false, "must not send during format preview");

const home = { lat: 52.46, lon: 13.38, address: "Rudow" };
const registration = {
  pushoverUserKey: "format-preview-only",
  distanceUnit: "km",
};

function assertPlainNotificationText(text, label) {
  assert.ok(text && !/\bundefined\b/i.test(text), `${label}: empty or undefined`);
  assert.ok(!/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(text), `${label}: flag emoji`);
  assert.ok(!/[🦜🛸🏳️]/.test(text), `${label}: decorative emoji`);
  assert.ok(!/[↗↘↖↙]/.test(text), `${label}: diagonal arrow`);
}

async function preview(plane, label) {
  const pending = await buildMilitaryPendingNotification(
    plane,
    registration,
    home,
    "format-preview-device",
    new Map(),
  );
  const { title, message: body } = pending.message;
  console.log(`[preview] ${label}`);
  console.log(`  title: ${title}`);
  console.log(`  body:  ${body}`);
  assertPlainNotificationText(title, `${label} title`);
  assertPlainNotificationText(body, `${label} body`);
  return { title, body };
}

const modelOp = await preview(
  {
    hex: "3f717c",
    lat: 52.42,
    lon: 13.52,
    flight: "GAF871",
    desc: "Airbus A400M",
    track: 90,
    alt_baro: 24934,
    baro_rate: 800,
    gs: 220,
    mil: true,
  },
  "model+operator",
);
assert.equal(modelOp.title, "Airbus A400M · Luftwaffe");
assert.match(modelOp.body, /E-bound/);
assert.match(modelOp.body, /↑/);

const callsignOnly = await preview(
  {
    hex: "abcdef",
    lat: 52.42,
    lon: 13.52,
    flight: "GAF871",
    track: 90,
    alt_baro: 24934,
    baro_rate: 0,
    gs: 220,
    mil: true,
  },
  "callsign-only",
);
assert.equal(callsignOnly.title, "GAF871");
assert.ok(!callsignOnly.title.includes("Luftwaffe"));
assert.ok(!callsignOnly.body.includes("↑"));
assert.ok(!callsignOnly.body.includes("↓"));

console.log("[ok] pushover notification format preview (no send)");
