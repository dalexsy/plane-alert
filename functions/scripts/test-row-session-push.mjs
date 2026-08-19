/**
 * Gate: row session notify reuses household Pushover, never fetches a plane
 * photo, and refuses unauthenticated callers.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  resolveRowSessionPushDevice,
  sendRowSessionPush,
  ROW_SESSION_PUSH_DOC_ID,
} = require("../lib/services/row-session-push.js");
const {
  isRowSessionNotifyAuthorized,
  readRowSessionNotifyToken,
  rowSessionNotifySecret,
} = require("../lib/services/row-session-push-auth.js");
const {
  PUSHOVER_USER_KEY,
} = require("@plane-alert/shared");

assert.equal(ROW_SESSION_PUSH_DOC_ID, "row-session");

assert.equal(
  resolveRowSessionPushDevice([
    { deviceName: "galaxys24", platform: "android" },
    { deviceName: "pixel10", platform: "android" },
  ]),
  "",
  "household phones have no owner label — omit device name",
);

assert.equal(
  resolveRowSessionPushDevice([
    { deviceName: "pixel10", deviceSlug: "chris-pixel10", platform: "android" },
    { deviceName: "galaxys24", platform: "android" },
  ]),
  "pixel10",
  "explicit Chris hint on one household phone is enough",
);

assert.equal(
  resolveRowSessionPushDevice([
    { deviceName: "pixel10", platform: "chris work phone" },
    { deviceName: "galaxys24", platform: "chris tablet" },
  ]),
  "",
  "two Chris-hinted phones stay household-wide",
);

const secret = "row-notify-test-secret";
const env = { ROW_SESSION_NOTIFY_SECRET: secret };
assert.equal(rowSessionNotifySecret(env), secret);
assert.equal(rowSessionNotifySecret({}), "");
assert.equal(
  isRowSessionNotifyAuthorized({ headers: {} }, env),
  false,
  "missing token is unauthorized",
);
assert.equal(
  isRowSessionNotifyAuthorized(
    { headers: { authorization: `Bearer ${secret}` } },
    env,
  ),
  true,
);
assert.equal(
  isRowSessionNotifyAuthorized(
    { headers: { "x-row-notify-secret": secret } },
    env,
  ),
  true,
);
assert.equal(
  isRowSessionNotifyAuthorized(
    { headers: { authorization: "Bearer wrong-secret-value" } },
    env,
  ),
  false,
);
assert.equal(
  isRowSessionNotifyAuthorized(
    { headers: { authorization: `Bearer ${secret}` } },
    {},
  ),
  false,
  "unset secret fails closed",
);
assert.equal(
  readRowSessionNotifyToken({
    headers: { authorization: `Bearer ${secret}` },
  }),
  secret,
);

const calls = [];
const sent = await sendRowSessionPush(
  { title: "Row session saved", message: "Daryl saved 2000m" },
  async (userKey, deviceName, message, docId) => {
    calls.push({ userKey, deviceName, message, docId });
    return true;
  },
);
assert.equal(sent, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].userKey, PUSHOVER_USER_KEY);
assert.equal(calls[0].deviceName, "");
assert.equal(calls[0].docId, "row-session");
assert.equal(calls[0].message.title, "Row session saved");
assert.equal(calls[0].message.message, "Daryl saved 2000m");
assert.equal(
  Object.prototype.hasOwnProperty.call(calls[0].message, "model"),
  false,
  "row payload must not set model (that fetches an aircraft image)",
);
assert.equal(calls[0].message.hex, undefined);
assert.equal(calls[0].message.registration, undefined);

const skipped = await sendRowSessionPush(
  { title: "   ", message: "nope" },
  async () => {
    throw new Error("must not send empty title");
  },
);
assert.equal(skipped, false);

console.log("[ok] row session pushover");
