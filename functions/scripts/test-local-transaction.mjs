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

fs.rmSync(tmp, { recursive: true, force: true });
console.log("[ok] local transaction cooldown gate");
