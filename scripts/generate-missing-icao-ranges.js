/**
 * Global ICAO Range Gap Analyzer
 */

const fs = require("fs");
const path = require("path");
const {
  analyzeGlobalGaps,
} = require("./lib/icao-gap-analysis");
const { printGapReport } = require("./lib/icao-gap-allocations");

const icaoRangesPath = path.join(
  __dirname,
  "../src/assets/data/icao-country-ranges.json",
);
const currentRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));

function main() {
  console.log("Global ICAO Range Gap Analyzer\n");
  console.log(
    "This tool analyzes the entire ICAO address space for significant allocation gaps.\n",
  );

  const gaps = analyzeGlobalGaps(currentRanges);
  printGapReport(gaps);
}

if (require.main === module) {
  main();
}

module.exports = { main };
