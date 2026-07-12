/**
 * ICAO Country Mismatch Detection Tool
 *
 * Usage:
 * node scripts/icao-mismatch-detector.js <icao-hex> [registration] [callsign]
 */

const {
  loadMismatchData,
  analyzeAircraft,
  findIcaoRange,
  getCountryFromRegistration,
  getCountryFromCallsign,
} = require("./lib/icao-mismatch-analysis");

const data = loadMismatchData(__dirname);

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      "Usage: node icao-mismatch-detector.js <icao-hex> [registration] [callsign]",
    );
    console.log("");
    console.log("Examples:");
    console.log("  node icao-mismatch-detector.js 464A91 OH-LWA OHU609");
    console.log("  node icao-mismatch-detector.js 4B7FAC HB-RSJ SWR123");
    console.log("  node icao-mismatch-detector.js 464A91");
    process.exit(1);
  }

  const [icaoHex, registration, callsign] = args;

  if (!/^[0-9A-Fa-f]+$/.test(icaoHex)) {
    console.error("Error: ICAO hex must be hexadecimal");
    process.exit(1);
  }

  analyzeAircraft(icaoHex.toUpperCase(), registration, callsign, data);
}

module.exports = {
  analyzeAircraft: (icao, reg, call) =>
    analyzeAircraft(icao, reg, call, data),
  findIcaoRange,
  getCountryFromRegistration,
  getCountryFromCallsign,
};
