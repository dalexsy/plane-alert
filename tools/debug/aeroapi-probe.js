/*
  AeroAPI probe tool

  Purpose:
  - Quickly see what FlightAware AeroAPI returns for a specific callsign/ident or tail number.
  - Designed for your "what data do we actually get for military flights?" debugging.

  Usage (PowerShell / cmd):
    set AEROAPI_KEY=YOUR_KEY_HERE
    node tools/debug/aeroapi-probe.js --ident NM102

  Optional:
    node tools/debug/aeroapi-probe.js --tail OO-ABC

  Notes:
  - This script prints a compact summary + the raw JSON payload.
  - It does NOT scrape ADS-B Exchange; you still need an ident/tail from somewhere.
*/

const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";

function parseArgs(argv) {
  const args = { ident: undefined, tail: undefined, maxPages: 1 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ident" && argv[i + 1]) {
      args.ident = argv[++i];
    } else if (a === "--tail" && argv[i + 1]) {
      args.tail = argv[++i];
    } else if (a === "--max-pages" && argv[i + 1]) {
      const v = Number(argv[++i]);
      if (!Number.isNaN(v) && v > 0) args.maxPages = v;
    }
  }
  return args;
}

async function aeroapiGet(path, apiKey) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "x-apikey": apiKey,
    },
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _nonJsonBody: text };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${path}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

function compactFlight(f) {
  if (!f || typeof f !== "object") return null;
  return {
    ident: f.ident,
    ident_icao: f.ident_icao,
    flight_number: f.flight_number,
    operator: f.operator,
    operator_icao: f.operator_icao,
    origin: f.origin?.code,
    destination: f.destination?.code,
    status: f.status,
    filed_departure_time: f.filed_departure_time,
    estimated_departure_time: f.estimated_departure_time,
    actual_departure_time: f.actual_departure_time,
    filed_arrival_time: f.filed_arrival_time,
    estimated_arrival_time: f.estimated_arrival_time,
    actual_arrival_time: f.actual_arrival_time,
    route_distance: f.route_distance,
    last_position_time: f.last_position_time,
  };
}

async function main() {
  const { ident, tail, maxPages } = parseArgs(process.argv);

  const apiKey = process.env.AEROAPI_KEY;
  if (!apiKey) {
    console.error("Missing env var AEROAPI_KEY");
    process.exit(2);
  }

  const query = ident || tail;
  if (!query) {
    console.error(
      "Usage: node tools/debug/aeroapi-probe.js --ident <CALLSIGN>  OR  --tail <REG>"
    );
    process.exit(2);
  }

  // Try flights/{ident} first. For GA, a tail number often works as an ident too.
  const endpoint = `/flights/${encodeURIComponent(
    query
  )}?max_pages=${encodeURIComponent(String(maxPages))}`;

  try {
    const data = await aeroapiGet(endpoint, apiKey);

    const flights = Array.isArray(data?.flights) ? data.flights : [];

    console.log("=== AeroAPI Probe ===");
    console.log(`Query: ${query}`);
    console.log(`Flights returned: ${flights.length}`);

    if (flights.length > 0) {
      console.log("\n--- Compact summary (first 5) ---");
      for (const f of flights.slice(0, 5)) {
        console.log(JSON.stringify(compactFlight(f), null, 2));
      }
    }

    console.log("\n--- Raw response ---");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("AeroAPI request failed:", e.message);
    if (e.body) {
      console.error("Body:", JSON.stringify(e.body, null, 2));
    }
    process.exit(1);
  }
}

main();
