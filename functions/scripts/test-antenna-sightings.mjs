/**
 * Antenna sightings upsert + list query. Run after functions tsc.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  upsertSighting,
  applySnapshot,
} = require("../lib/services/antenna-sighting-upsert.js");
const {
  parseAntennaListQuery,
  queryAntennaSightings,
} = require("../lib/services/antenna-sighting-query.js");

const t0 = 1_700_000_000_000;

const first = upsertSighting(
  undefined,
  {
    hex: "3C66A6",
    flight: "DLH1YY  ",
    alt_baro: 35975,
    r_dst: 37.659,
    r_dir: 172.4,
    category: "A3",
    messages: 100,
  },
  t0,
);
assert.equal(first.hex, "3c66a6");
assert.equal(first.lastFlight, "DLH1YY");
assert.equal(first.hits, 1);
assert.equal(first.messages, 0);
assert.equal(first.lastMessages, 100);
assert.equal(first.closestNm, 37.659);
assert.equal(first.altMin, 35975);

const closer = upsertSighting(
  first,
  {
    hex: "3c66a6",
    flight: "DLH1YY",
    alt_baro: 34000,
    r_dst: 12.1,
    r_dir: 90,
    category: "A3",
    messages: 140,
  },
  t0 + 12_000,
);
assert.equal(closer.hits, 2);
assert.equal(closer.messages, 40);
assert.equal(closer.closestNm, 12.1);
assert.equal(closer.closestDir, 90);
assert.equal(closer.altMin, 34000);
assert.equal(closer.altMax, 35975);
assert.equal(closer.firstSeen, t0);
assert.equal(closer.lastSeen, t0 + 12_000);

const farther = upsertSighting(
  closer,
  {
    hex: "3c66a6",
    flight: "DLH99Z",
    alt_baro: "ground",
    r_dst: 20,
    r_dir: 10,
    messages: 150,
  },
  t0 + 24_000,
);
assert.equal(farther.closestNm, 12.1);
assert.equal(farther.lastFlight, "DLH99Z");
assert.deepEqual(farther.flights, ["DLH99Z", "DLH1YY"]);
assert.equal(farther.messages, 50);
assert.equal(farther.altMin, 34000);

const reset = upsertSighting(
  farther,
  { hex: "3c66a6", messages: 8, flight: "DLH99Z" },
  t0 + 36_000,
);
assert.equal(reset.messages, 58);

assert.equal(upsertSighting(undefined, { flight: "NONE" }, t0), null);

const { byHex, upserted } = applySnapshot(
  {},
  [
    { hex: "4bb263", flight: "THY9RZ", r_dst: 29.7, r_dir: 245 },
    { hex: "  ", flight: "SKIP" },
    { hex: "458665", flight: "CAT328", r_dst: 5.2, r_dir: 10 },
  ],
  t0,
);
assert.equal(upserted, 2);
assert.equal(Object.keys(byHex).length, 2);

const listed = queryAntennaSightings(byHex, {
  q: "cat",
  sort: "closest",
  limit: 10,
  now: t0,
});
assert.equal(listed.matched, 1);
assert.equal(listed.rows[0].hex, "458665");
assert.equal("lastMessages" in listed.rows[0], false);

const parsed = parseAntennaListQuery({ q: "DLH", sort: "closest", today: "1" });
assert.equal(parsed.sort, "closest");
assert.equal(parsed.today, true);
assert.equal(parsed.q, "dlh");

console.log("[ok] antenna sightings upsert + query");
