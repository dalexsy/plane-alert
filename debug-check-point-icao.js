const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function main() {
  const [icaoArg, latArg, lonArg, radiusNmArg] = process.argv.slice(2);

  const icao = (icaoArg || "").trim().toLowerCase();
  if (!icao) {
    console.error(
      "Usage: node debug-check-point-icao.js <ICAO_HEX> <LAT> <LON> <RADIUS_NM>"
    );
    process.exit(2);
  }

  const lat = Number(latArg);
  const lon = Number(lonArg);
  const radiusNm = Number(radiusNmArg);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(radiusNm)
  ) {
    console.error("Invalid lat/lon/radiusNm");
    process.exit(2);
  }

  const url = `https://api.adsb.one/v2/point/${lat}/${lon}/${radiusNm.toFixed(
    2
  )}`;
  console.log("URL:", url);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "plane-alert.surge.sh",
      Accept: "application/json",
    },
    timeout: 10000,
  });

  console.log("HTTP:", res.status, res.statusText);
  if (!res.ok) process.exit(1);

  const payload = await res.json();
  const ac = payload.ac || [];
  const match = ac.find((p) => String(p.hex || "").toLowerCase() === icao);

  console.log("Total aircraft:", ac.length);
  console.log("Found ICAO in point feed:", Boolean(match));

  if (match) {
    console.log("Match summary:", {
      hex: match.hex,
      flight: match.flight,
      r: match.r,
      t: match.t,
      desc: match.desc,
      lat: match.lat,
      lon: match.lon,
      seen_pos: match.seen_pos,
      seen: match.seen,
      gs: match.gs,
      track: match.track,
      alt_baro: match.alt_baro,
      category: match.category,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
