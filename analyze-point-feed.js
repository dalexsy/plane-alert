const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function fetchPoint(lat, lon, radiusNm) {
  const url = `https://api.adsb.one/v2/point/${lat}/${lon}/${radiusNm.toFixed(2)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'plane-alert.surge.sh', Accept: 'application/json' },
    timeout: 10000,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  const payload = await res.json();
  const ac = payload.ac || [];
  return { url, ac };
}

function summarizeSeenPos(ac) {
  const values = ac
    .map((p) => p.seen_pos)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  values.sort((a, b) => a - b);
  const pct = (q) => {
    if (values.length === 0) return null;
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor(q * (values.length - 1))));
    return values[idx];
  };
  return {
    count: values.length,
    min: values[0] ?? null,
    p50: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    max: values[values.length - 1] ?? null,
  };
}

async function main() {
  const [icaoArg, latArg, lonArg] = process.argv.slice(2);
  const icao = (icaoArg || '').trim().toLowerCase();
  const lat = Number(latArg);
  const lon = Number(lonArg);
  if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('Usage: node analyze-point-feed.js <ICAO_HEX> <LAT> <LON>');
    process.exit(2);
  }

  const radii = [20, 50, 80, 120, 200, 300];
  for (const r of radii) {
    const { url, ac } = await fetchPoint(lat, lon, r);
    const found = ac.find((p) => String(p.hex || '').toLowerCase() === icao);
    const seenPosStats = summarizeSeenPos(ac);

    console.log('---');
    console.log('URL:', url);
    console.log('Aircraft:', ac.length);
    console.log('Found:', Boolean(found));
    console.log('seen_pos stats (s):', seenPosStats);

    if (found) {
      console.log('Match:', {
        hex: found.hex,
        flight: found.flight,
        t: found.t,
        desc: found.desc,
        lat: found.lat,
        lon: found.lon,
        seen_pos: found.seen_pos,
        seen: found.seen,
      });
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
