/**
 * Gate: one account + ICAO claim. A second phone must not open a second
 * inbox row. Do not put the device name back in the cooldown id.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createLocalFirestore,
  patchAdminFirestoreNamespace,
} = require("../lib/local-firestore.js");
const admin = require("firebase-admin");
const {
  checkAndMarkNotified,
} = require("../lib/services/notification-cooldown.js");

patchAdminFirestoreNamespace(admin);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "planes-local-tx-"));
const storePath = path.join(tmp, "store.json");
const db = createLocalFirestore(storePath);

const userKey = "testuserkey";
const icao = "3F93E4";
const device = "pixel10";
const otherDevice = "galaxys24";
const legacyId = `${userKey}__${device}__${icao}`;
const householdId = `${userKey}__${icao}`;
assert.equal(
  householdId.split("__").length,
  2,
  "cooldown id is userKey + ICAO only — never a device segment",
);

// Pre-seed expired per-device cooldown (production leftover).
await db.collection("notification-cooldowns").doc(legacyId).set({
  userKey,
  icao,
  lastSent: Date.now() - 60 * 60 * 1000,
});

const ok = await checkAndMarkNotified(db, userKey, device, icao, 30 * 60 * 1000);
assert.equal(ok, true, "claim must succeed for lowercase device name");

const after = await db.collection("notification-cooldowns").doc(householdId).get();
assert.equal(after.exists, true, "household claim doc must remain after transaction");
assert.equal(typeof after.data()?.lastSent, "number");

const legacyAfter = await db.collection("notification-cooldowns").doc(legacyId).get();
assert.equal(legacyAfter.exists, false, "legacy per-device cooldown must be pruned");

const blocked = await checkAndMarkNotified(
  db,
  userKey,
  device,
  icao,
  30 * 60 * 1000,
);
assert.equal(blocked, false, "second claim inside cooldown must be false");

const blockedOther = await checkAndMarkNotified(
  db,
  userKey,
  otherDevice,
  icao,
  30 * 60 * 1000,
);
assert.equal(
  blockedOther,
  false,
  "other household phone must not send a second inbox row",
);

const paddedKey = ` ${userKey} `;
const blockedPadded = await checkAndMarkNotified(
  db,
  paddedKey,
  otherDevice,
  icao,
  30 * 60 * 1000,
);
assert.equal(
  blockedPadded,
  false,
  "trimmed userKey must share the same household claim",
);

const {
  householdPushoverDeviceTarget,
} = require("@plane-alert/shared");
const { householdTargetFromRegistrations } = require("../lib/utils.js");
assert.equal(
  householdPushoverDeviceTarget(["pixel10", "desktop", "galaxys24"], "pixel10"),
  "galaxys24,pixel10",
);
assert.equal(householdPushoverDeviceTarget([], "pixel10"), "pixel10");
assert.equal(
  householdTargetFromRegistrations(
    [
      { id: "u__galaxys24", data: { deviceName: "galaxys24" } },
      { id: "u__pixel10", data: { deviceName: "pixel10" } },
    ],
    new Set(["galaxys24", "pixel10", "pixel5", "desktop"]),
  ),
  "galaxys24,pixel10",
);

const {
  pickHouseholdPrimary,
  mergeHouseholdInRangeAircraft,
} = require("../lib/services/household-notify.js");
const galaxy = {
  id: "u__galaxys24",
  ref: { id: "u__galaxys24" },
  data: {
    deviceName: "galaxys24",
    location: { lat: 52.5, lon: 13.4 },
    radiusKm: 100,
  },
};
const pixel = {
  id: "u__pixel10",
  ref: { id: "u__pixel10" },
  data: {
    deviceName: "pixel10",
    notifyProximity: true,
    location: { lat: 52.37, lon: 13.5 },
    radiusKm: 100,
  },
};
const primary = pickHouseholdPrimary([galaxy, pixel]);
assert.equal(primary.id, pixel.id, "one primary per account, not one per phone");
const merged = mergeHouseholdInRangeAircraft([galaxy, pixel], new Map([
  [
    "52.5_13.4_100",
    {
      aircraft: [{ hex: "aaaaaa", lat: 52.5, lon: 13.4 }],
      snapshotAgeMs: 1000,
    },
  ],
  [
    "52.37_13.5_100",
    {
      aircraft: [{ hex: "bbbbbb", lat: 52.37, lon: 13.5 }],
      snapshotAgeMs: 1000,
    },
  ],
]));
assert.equal(merged.skipRadiusFilter, true);
assert.equal(merged.aircraft.length, 2, "both household homes contribute aircraft");
assert.equal(
  new Set(merged.aircraft.map((p) => p.hex.toUpperCase())).size,
  2,
);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("[ok] local transaction cooldown gate");
