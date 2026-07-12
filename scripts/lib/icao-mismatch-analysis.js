const lookup = require("./icao-mismatch-lookup");
const { analyzeAircraft } = require("./icao-mismatch-report");

module.exports = {
  ...lookup,
  analyzeAircraft: (icaoHex, registration, callsign, data) =>
    analyzeAircraft(icaoHex, registration, callsign, data, lookup),
};
