// Test script to debug country detection for specific aircraft
const fs = require("fs");
const path = require("path");

// Load the registration prefix data
const registrationPrefixPath = path.join(
  __dirname,
  "../src/assets/data/registration-country-prefix.json"
);
const registrationCountryPrefix = JSON.parse(
  fs.readFileSync(registrationPrefixPath, "utf8")
);

// Load ICAO ranges data
const icaoRangesPath = path.join(
  __dirname,
  "../src/assets/data/icao-country-ranges.json"
);
const icaoCountryRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));

function getCountryFromRegistration(registration) {
  const reg = registration.trim().toUpperCase();

  // Sort prefixes by length (longest first) to match most specific prefix
  const sortedPrefixes = Object.keys(registrationCountryPrefix).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return {
        countryCode: registrationCountryPrefix[prefix],
        source: "registration",
        prefix: prefix,
      };
    }
  }

  return { countryCode: "Unknown", source: "registration" };
}

function getCountryFromIcaoHex(icaoHex) {
  const icaoDec = parseInt(icaoHex, 16);

  for (const range of icaoCountryRanges) {
    if (icaoDec >= range.startDec && icaoDec <= range.finishDec) {
      return {
        countryCode: range.countryISO2,
        source: "icao-hex",
        range: `${range.startHex}-${range.finishHex}`,
        decimal: icaoDec,
      };
    }
  }

  return { countryCode: "Unknown", source: "icao-hex" };
}

function analyzeAircraft(registration, icaoHex) {
  console.log(`\n=== Analyzing Aircraft ===`);
  console.log(`Registration: ${registration}`);
  console.log(`ICAO Hex: ${icaoHex}`);

  const regResult = getCountryFromRegistration(registration);
  console.log(`\nRegistration lookup:`, regResult);

  const icaoResult = getCountryFromIcaoHex(icaoHex);
  console.log(`ICAO hex lookup:`, icaoResult);

  if (
    regResult.countryCode !== "Unknown" &&
    icaoResult.countryCode !== "Unknown"
  ) {
    if (regResult.countryCode !== icaoResult.countryCode) {
      console.log(`\n⚠️  MISMATCH DETECTED!`);
      console.log(`Registration suggests: ${regResult.countryCode}`);
      console.log(`ICAO hex suggests: ${icaoResult.countryCode}`);
      console.log(
        `\nRecommendation: Use registration-based country (${regResult.countryCode}) as it's more reliable for civilian aircraft.`
      );
    } else {
      console.log(`\n✅ Both methods agree: ${regResult.countryCode}`);
    }
  }
}

// Test the specific case
const args = process.argv.slice(2);
if (args.length >= 2) {
  analyzeAircraft(args[0], args[1]);
} else {
  // Default test case
  analyzeAircraft("OHU609", "464A91");
}
