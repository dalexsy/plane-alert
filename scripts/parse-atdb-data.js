/**
 * Parse ATDB ICAO allocation table and generate JSON ranges.
 */

const path = require("path");
const {
  parseATDBData,
  testSpecificCases,
  saveRanges,
  updateIcaoRangesFromAtdb,
} = require("./lib/atdb-parse-utils");

const atdbHtmlPath =
  "C:\\Users\\dalex\\Downloads\\ATDB - ICAO 24-bit addresses - Decode.html";
const outputJsonPath = path.resolve(
  __dirname,
  "../src/assets/data/icao-country-ranges.json",
);

updateIcaoRangesFromAtdb(atdbHtmlPath, outputJsonPath);

const ranges = parseATDBData();
testSpecificCases(ranges);
saveRanges(ranges);

console.log("\nSummary:");
console.log("ATDB data parsed and converted to proper format");
console.log("Problem cases: OHU609 (464A91) -> FI, NAF15 (480C1B) -> NL");
