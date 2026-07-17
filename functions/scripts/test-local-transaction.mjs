/**
 * Gate: LocalTransaction must support delete and not wipe a claim when
 * "legacy" cooldown path equals the canonical per-device path.
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
const cooldownId = `${userKey}__${device}__${icao}`;

// Pre-seed expired cooldown (same shape as production).
await db.collection("notification-cooldowns").doc(cooldownId).set({
  userKey,
  icao,
  lastSent: Date.now() - 60 * 60 * 1000,
});

const ok = await checkAndMarkNotified(db, userKey, device, icao, 30 * 60 * 1000);
assert.equal(ok, true, "claim must succeed for lowercase device name");

const after = await db.collection("notification-cooldowns").doc(cooldownId).get();
assert.equal(after.exists, true, "claim doc must remain after transaction");
assert.equal(typeof after.data()?.lastSent, "number");

const blocked = await checkAndMarkNotified(
  db,
  userKey,
  device,
  icao,
  30 * 60 * 1000,
);
assert.equal(blocked, false, "second claim inside cooldown must be false");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("[ok] local transaction cooldown gate");
