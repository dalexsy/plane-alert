const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function main() {
  const [icaoArg] = process.argv.slice(2);
  const icao = (icaoArg || '').trim().toLowerCase();
  if (!icao) {
    console.error('Usage: node verify-icao-visibility.js <ICAO_HEX>');
    process.exit(2);
  }

  const hexUrl = `https://api.adsb.one/v2/hex/${icao}`;
  const res = await fetch(hexUrl, {
    headers: { 'User-Agent': 'plane-alert.surge.sh', Accept: 'application/json' },
    timeout: 10000,
  });

  console.log('HEX URL:', hexUrl);
  console.log('HEX HTTP:', res.status, res.statusText);
  if (!res.ok) process.exit(1);

  const rawText = await res.text();
  console.log('HEX raw (first 400 chars):', rawText.slice(0, 400));

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.log('HEX response was not valid JSON.');
    process.exit(1);
  }

  // adsb.one responses vary by endpoint/version; normalize to a single aircraft object.
  const aircraft =
    parsed && typeof parsed === 'object' && Array.isArray(parsed.ac)
      ? parsed.ac[0]
      : parsed;

  const lp = aircraft?.lastPosition || null;
  console.log('HEX summary:', {
    hex: aircraft?.hex,
    flight: aircraft?.flight,
    t: aircraft?.t,
    desc: aircraft?.desc,
    seen: aircraft?.seen,
    lastPosition: lp,
  });

  if (!lp || typeof lp.lat !== 'number' || typeof lp.lon !== 'number') {
    console.log('No lastPosition lat/lon available; cannot probe point feed centered on it.');
    process.exit(0);
  }

  const { spawnSync } = require('child_process');
  const out = spawnSync(
    process.execPath,
    ['analyze-point-feed.js', icao, String(lp.lat), String(lp.lon)],
    { encoding: 'utf8' }
  );

  process.stdout.write(out.stdout);
  process.stderr.write(out.stderr);
  process.exit(out.status ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
