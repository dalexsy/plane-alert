/**
 * Gate: after the Pi split, prod must POST the kiosk speaker host.
 * Local pw-play on dryl-prod is not audible and must not ack the visit.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  isKioskQuietHoursBerlin,
  playKioskAlertSoundAsync,
  resetKioskAlertSoundForTests,
} = require("../lib/services/kiosk-alert-sound.js");
const {
  DEFAULT_KIOSK_PLAY_URL,
  isKioskAudioHost,
  resolveKioskPlayUrl,
  shouldUseRemoteKioskPlay,
} = require("../lib/services/kiosk-alert-remote.js");

assert.equal(isKioskAudioHost("magicmirror"), true);
assert.equal(isKioskAudioHost("magicmirror.local"), true);
assert.equal(isKioskAudioHost("dryl-prod"), false);
assert.equal(shouldUseRemoteKioskPlay({}, "dryl-prod"), true);
assert.equal(shouldUseRemoteKioskPlay({}, "magicmirror"), false);
assert.equal(
  shouldUseRemoteKioskPlay(
    { PLANES_KIOSK_PLAY_URL: DEFAULT_KIOSK_PLAY_URL },
    "magicmirror",
  ),
  true,
  "explicit PLAY_URL forces remote even on the kiosk host",
);
assert.equal(
  shouldUseRemoteKioskPlay({ DRYL_ENV: "staging" }, "dryl-prod"),
  false,
  "staging must not ring the house speaker",
);
assert.equal(
  shouldUseRemoteKioskPlay(
    { PLANES_KIOSK_PLAY_URL: DEFAULT_KIOSK_PLAY_URL },
    "dryl-staging",
  ),
  false,
);
assert.equal(resolveKioskPlayUrl({}), DEFAULT_KIOSK_PLAY_URL);

const daytime = new Date("2026-08-20T10:00:00Z");
const night = new Date("2026-08-20T20:30:00Z");
assert.equal(isKioskQuietHoursBerlin(night), true, "22:30 Berlin is quiet");
assert.equal(isKioskQuietHoursBerlin(daytime), false, "12:00 Berlin is open");

function spawnRecorder() {
  const calls = [];
  return {
    calls,
    spawn: (...args) => {
      calls.push(args);
      return { pid: 1 };
    },
  };
}

resetKioskAlertSoundForTests();
const remoteProd = [];
const spawnProd = spawnRecorder();
let playedProd = 0;
await playKioskAlertSoundAsync(
  "ABC123",
  "military-in-range",
  { model: "C-130 Hercules", onPlayed: () => playedProd++ },
  {
    env: { PLANES_KIOSK_PLAY_TOKEN: "secret" },
    hostname: "dryl-prod",
    now: daytime,
    nowMs: daytime.getTime(),
    postRemote: async (body) => {
      remoteProd.push(body);
      return true;
    },
    spawnLocal: spawnProd.spawn,
    resolvePlayerBin: () => null,
  },
);
assert.equal(spawnProd.calls.length, 0, "prod must not spawn local pw-play");
assert.equal(remoteProd.length, 1, "prod must POST the kiosk");
assert.equal(remoteProd[0].variant, "hercules");
assert.equal(playedProd, 1);

resetKioskAlertSoundForTests();
const remoteUrl = [];
const spawnUrl = spawnRecorder();
await playKioskAlertSoundAsync(
  "DEF456",
  "military-pushover",
  { model: "Airbus A400M" },
  {
    env: {
      PLANES_KIOSK_PLAY_URL: DEFAULT_KIOSK_PLAY_URL,
      PLANES_KIOSK_PLAY_TOKEN: "secret",
    },
    hostname: "magicmirror",
    now: daytime,
    nowMs: daytime.getTime() + 20_000,
    postRemote: async (body) => {
      remoteUrl.push(body);
      return true;
    },
    spawnLocal: spawnUrl.spawn,
    resolvePlayerBin: () => "/usr/bin/pw-play",
  },
);
assert.equal(spawnUrl.calls.length, 0, "PLAY_URL set must not local-spawn");
assert.equal(remoteUrl[0].variant, "a400");

resetKioskAlertSoundForTests();
let playedQuiet = 0;
const remoteQuiet = [];
const spawnQuiet = spawnRecorder();
await playKioskAlertSoundAsync(
  "NITE01",
  "military-in-range",
  { onPlayed: () => playedQuiet++ },
  {
    env: { PLANES_KIOSK_PLAY_TOKEN: "secret" },
    hostname: "dryl-prod",
    now: night,
    nowMs: night.getTime(),
    postRemote: async (body) => {
      remoteQuiet.push(body);
      return true;
    },
    spawnLocal: spawnQuiet.spawn,
  },
);
assert.equal(playedQuiet, 1, "quiet hours absorb the visit");
assert.equal(remoteQuiet.length, 0, "quiet hours must not POST");
assert.equal(spawnQuiet.calls.length, 0, "quiet hours must not spawn");

resetKioskAlertSoundForTests();
let playedFail = 0;
const remoteFail = [];
const spawnFail = spawnRecorder();
await playKioskAlertSoundAsync(
  "FAIL01",
  "military-in-range",
  { onPlayed: () => playedFail++ },
  {
    env: { PLANES_KIOSK_PLAY_TOKEN: "secret" },
    hostname: "dryl-prod",
    now: daytime,
    nowMs: daytime.getTime(),
    postRemote: async (body) => {
      remoteFail.push(body);
      return false;
    },
    spawnLocal: spawnFail.spawn,
    resolvePlayerBin: () => null,
  },
);
assert.equal(remoteFail.length, 1, "failed trigger still attempted kiosk POST");
assert.equal(spawnFail.calls.length, 0, "missing prod player is not a fallback");
assert.equal(playedFail, 0, "failed kiosk trigger must not ack");

resetKioskAlertSoundForTests();
let playedOff = 0;
const remoteOff = [];
await playKioskAlertSoundAsync(
  "OFF001",
  "military-in-range",
  { onPlayed: () => playedOff++ },
  {
    env: {
      PLANES_KIOSK_LOCAL_ALERT: "0",
      PLANES_KIOSK_PLAY_TOKEN: "secret",
    },
    hostname: "dryl-prod",
    now: daytime,
    postRemote: async (body) => {
      remoteOff.push(body);
      return true;
    },
  },
);
assert.equal(playedOff, 0);
assert.equal(remoteOff.length, 0);

resetKioskAlertSoundForTests();
let playedMissingToken = 0;
const spawnMissing = spawnRecorder();
const { postKioskAlertPlay } = require("../lib/services/kiosk-alert-remote.js");
const okMissing = await postKioskAlertPlay(
  { icao: "TOK001", reason: "military-in-range", variant: "default" },
  { PLANES_KIOSK_PLAY_URL: DEFAULT_KIOSK_PLAY_URL },
);
assert.equal(okMissing, false, "missing token is not success");
await playKioskAlertSoundAsync(
  "TOK001",
  "military-in-range",
  { onPlayed: () => playedMissingToken++ },
  {
    env: {},
    hostname: "dryl-prod",
    now: daytime,
    nowMs: daytime.getTime(),
    spawnLocal: spawnMissing.spawn,
    resolvePlayerBin: () => null,
  },
);
assert.equal(playedMissingToken, 0);
assert.equal(spawnMissing.calls.length, 0);

function listenJson(handler) {
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      handler(req, res, raw);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const posted = [];
const okServer = await listenJson((req, res, raw) => {
  posted.push({
    method: req.method,
    url: req.url,
    auth: req.headers.authorization,
    body: JSON.parse(raw || "{}"),
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});
const okPort = okServer.address().port;
const postedOk = await postKioskAlertPlay(
  { icao: "HTTP01", reason: "military-in-range", variant: "hercules" },
  {
    PLANES_KIOSK_PLAY_URL: `http://127.0.0.1:${okPort}/play`,
    PLANES_KIOSK_PLAY_TOKEN: "lan-secret",
  },
);
okServer.close();
assert.equal(postedOk, true);
assert.equal(posted[0].method, "POST");
assert.equal(posted[0].auth, "Bearer lan-secret");
assert.equal(posted[0].body.variant, "hercules");

resetKioskAlertSoundForTests();
let playedHttpFail = 0;
const spawnHttpFail = spawnRecorder();
const failServer = await listenJson((_req, res) => {
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});
const failPort = failServer.address().port;
await playKioskAlertSoundAsync(
  "HTTPFAIL",
  "military-in-range",
  { onPlayed: () => playedHttpFail++ },
  {
    env: {
      PLANES_KIOSK_PLAY_URL: `http://127.0.0.1:${failPort}/play`,
      PLANES_KIOSK_PLAY_TOKEN: "lan-secret",
    },
    hostname: "dryl-prod",
    now: daytime,
    nowMs: daytime.getTime() + 40_000,
    spawnLocal: spawnHttpFail.spawn,
    resolvePlayerBin: () => null,
  },
);
failServer.close();
assert.equal(spawnHttpFail.calls.length, 0);
assert.equal(playedHttpFail, 0, "HTTP 500 from kiosk is not a silent success");

console.log("[ok] kiosk alert sound remote play");
