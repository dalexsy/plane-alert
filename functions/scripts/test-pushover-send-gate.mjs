#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isPushoverSendEnabled } = require("../lib/services/pushover-send-gate.js");

assert.equal(isPushoverSendEnabled({}, "dryl-prod"), true);
assert.equal(isPushoverSendEnabled({}, "dryl-staging"), false);
assert.equal(
  isPushoverSendEnabled({ PLANES_API_PUSHOVER_ENABLED: "0" }, "dryl-prod"),
  false,
);
assert.equal(
  isPushoverSendEnabled({ PLANES_API_PUSHOVER_ENABLED: "1" }, "dryl-staging"),
  false,
  "hostname staging always wins — rsynced prod .env must not re-arm phones",
);
assert.equal(isPushoverSendEnabled({ DRYL_ENV: "staging" }, "dryl-prod"), false);

console.log("[ok] pushover send gate");
