/**
 * ICAO Country Mismatch Detection Tool
 *
 * This tool helps identify aircraft where the ICAO hex code country allocation
 * doesn't match the expected country based on registration prefix or callsign.
 *
 * Usage:
 * node scripts/icao-mismatch-detector.js <icao-hex> [registration] [callsign]
 *
 * Examples:
 * node scripts/icao-mismatch-detector.js 464A91 OH-LWA OHU609
 * node scripts/icao-mismatch-detector.js 4B7FAC HB-RSJ SWR123
 */

const fs = require("fs");
const path = require("path");

// Load data files
const icaoRangesPath = path.join(
  __dirname,
  "../src/assets/data/icao-country-ranges.json"
);
const regPrefixPath = path.join(
  __dirname,
  "../src/assets/data/registration-country-prefix.json"
);
const operatorCallSignsPath = path.join(
  __dirname,
  "../src/assets/operator-call-signs.json"
);

function loadData() {
  try {
    const icaoRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));
    const regPrefixes = JSON.parse(fs.readFileSync(regPrefixPath, "utf8"));
    const operatorCallSigns = fs.existsSync(operatorCallSignsPath)
      ? JSON.parse(fs.readFileSync(operatorCallSignsPath, "utf8"))
      : {};

    return { icaoRanges, regPrefixes, operatorCallSigns };
  } catch (error) {
    console.error("Error loading data files:", error.message);
    process.exit(1);
  }
}

function findIcaoRange(icaoHex, icaoRanges) {
  const icaoDecimal = parseInt(icaoHex, 16);

  const range = icaoRanges.find(
    (r) => icaoDecimal >= r.startDec && icaoDecimal <= r.finishDec
  );

  return range ? { ...range, icaoDecimal } : null;
}

function getCountryFromRegistration(registration, regPrefixes) {
  if (!registration) return null;

  const reg = registration.trim().toUpperCase();

  // Sort prefixes by length (longest first) for most specific match
  const sortedPrefixes = Object.keys(regPrefixes).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return {
        countryCode: regPrefixes[prefix],
        prefix: prefix,
        confidence: "high",
      };
    }
  }

  return null;
}

function getCountryFromCallsign(callsign, operatorCallSigns) {
  if (!callsign || !operatorCallSigns) return null;

  const cleanCallsign = callsign.trim().toUpperCase();

  // Extract operator code (usually first 3 characters)
  const operatorCode = cleanCallsign.substring(0, 3);

  if (operatorCallSigns[operatorCode]) {
    return {
      countryCode: operatorCallSigns[operatorCode].country,
      operator: operatorCallSigns[operatorCode],
      confidence: "medium",
    };
  }

  return null;
}

function analyzeAircraft(icaoHex, registration, callsign) {
  const { icaoRanges, regPrefixes, operatorCallSigns } = loadData();

  console.log("=".repeat(60));
  console.log("ICAO COUNTRY MISMATCH ANALYSIS");
  console.log("=".repeat(60));
  console.log(`ICAO Hex: ${icaoHex}`);
  console.log(`Registration: ${registration || "N/A"}`);
  console.log(`Callsign: ${callsign || "N/A"}`);
  console.log("");

  // Analyze ICAO hex allocation
  const icaoRange = findIcaoRange(icaoHex, icaoRanges);
  console.log("ICAO HEX ANALYSIS:");
  if (icaoRange) {
    console.log(`  Range: ${icaoRange.startHex}-${icaoRange.finishHex}`);
    console.log(
      `  Decimal: ${icaoRange.icaoDecimal} (${icaoRange.startDec}-${icaoRange.finishDec})`
    );
    console.log(`  Country: ${icaoRange.countryISO2}`);
    console.log(`  Military: ${icaoRange.isMilitary ? "Yes" : "No"}`);
  } else {
    console.log("  ❌ No ICAO range found - unknown allocation");
  }

  console.log("");

  // Analyze registration
  const regResult = getCountryFromRegistration(registration, regPrefixes);
  console.log("REGISTRATION ANALYSIS:");
  if (regResult) {
    console.log(`  Prefix: ${regResult.prefix}`);
    console.log(`  Country: ${regResult.countryCode}`);
    console.log(`  Confidence: ${regResult.confidence}`);
  } else {
    console.log("  ❌ No registration prefix match found");
  }

  console.log("");

  // Analyze callsign
  const callsignResult = getCountryFromCallsign(callsign, operatorCallSigns);
  console.log("CALLSIGN ANALYSIS:");
  if (callsignResult) {
    console.log(`  Operator Code: ${callsign.substring(0, 3)}`);
    console.log(`  Country: ${callsignResult.countryCode}`);
    console.log(`  Operator: ${callsignResult.operator.name || "Unknown"}`);
    console.log(`  Confidence: ${callsignResult.confidence}`);
  } else {
    console.log("  ❌ No callsign operator match found");
  }

  console.log("");
  console.log("MISMATCH DETECTION:");

  const countries = new Set();
  if (icaoRange) countries.add(icaoRange.countryISO2);
  if (regResult) countries.add(regResult.countryCode);
  if (callsignResult) countries.add(callsignResult.countryCode);

  if (countries.size > 1) {
    console.log("  ⚠️  MISMATCH DETECTED!");
    console.log(
      `  Different countries found: ${Array.from(countries).join(", ")}`
    );

    // Provide recommendations
    console.log("");
    console.log("RECOMMENDATIONS:");

    if (
      regResult &&
      icaoRange &&
      regResult.countryCode !== icaoRange.countryISO2
    ) {
      console.log(
        `  • Registration suggests ${regResult.countryCode}, but ICAO range is ${icaoRange.countryISO2}`
      );

      // Check if this might be a range split needed
      console.log(
        `  • Consider if ICAO range ${icaoRange.startHex}-${icaoRange.finishHex} needs to be split`
      );
      console.log(
        `  • Or check if this is a special case (military, leased aircraft, etc.)`
      );

      // Find other Finnish ranges for comparison
      const countryRanges = icaoRanges.filter(
        (r) => r.countryISO2 === regResult.countryCode
      );
      if (countryRanges.length > 0) {
        console.log(`  • Other ${regResult.countryCode} ranges:`);
        countryRanges.forEach((range) => {
          console.log(
            `    - ${range.startHex}-${range.finishHex} (${range.startDec}-${range.finishDec})`
          );
        });
      }
    }

    // Check for potential data collection
    console.log("");
    console.log("DATA COLLECTION SUGGESTION:");
    console.log(`  Add this to mismatch tracking:`);
    console.log(`  {`);
    console.log(`    "icao": "${icaoHex}",`);
    console.log(`    "registration": "${registration || ""}",`);
    console.log(`    "callsign": "${callsign || ""}",`);
    console.log(
      `    "icaoCountry": "${icaoRange ? icaoRange.countryISO2 : "Unknown"}",`
    );
    console.log(
      `    "regCountry": "${regResult ? regResult.countryCode : "Unknown"}",`
    );
    console.log(
      `    "callsignCountry": "${
        callsignResult ? callsignResult.countryCode : "Unknown"
      }",`
    );
    console.log(`    "timestamp": "${new Date().toISOString()}"`);
    console.log(`  }`);
  } else if (countries.size === 1) {
    console.log("  ✅ No mismatch detected - all sources agree");
  } else {
    console.log("  ❓ Insufficient data to determine mismatch");
  }

  console.log("=".repeat(60));
}

function generateMismatchReport() {
  console.log("ICAO Mismatch Detection Report Generator");
  console.log(
    "This feature would analyze historical flight data to find patterns..."
  );
  console.log("Future enhancement: Integrate with real-time data feeds");
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      "Usage: node icao-mismatch-detector.js <icao-hex> [registration] [callsign]"
    );
    console.log("");
    console.log("Examples:");
    console.log("  node icao-mismatch-detector.js 464A91 OH-LWA OHU609");
    console.log("  node icao-mismatch-detector.js 4B7FAC HB-RSJ SWR123");
    console.log("  node icao-mismatch-detector.js 464A91  # ICAO only");
    process.exit(1);
  }

  const [icaoHex, registration, callsign] = args;

  if (!/^[0-9A-Fa-f]+$/.test(icaoHex)) {
    console.error("Error: ICAO hex must be hexadecimal");
    process.exit(1);
  }

  analyzeAircraft(icaoHex.toUpperCase(), registration, callsign);
}

module.exports = {
  analyzeAircraft,
  findIcaoRange,
  getCountryFromRegistration,
  getCountryFromCallsign,
};
