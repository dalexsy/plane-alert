console.log("Starting ICAO analysis...");

const fs = require("fs");
const path = require("path");

try {
  // Load the current ICAO country ranges
  const icaoRangesPath = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "data",
    "icao-country-ranges.json"
  );
  console.log("Loading:", icaoRangesPath);

  const icaoRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));
  console.log("Loaded", icaoRanges.length, "ICAO ranges");

  // Find European allocations in 50xxxx range
  const europeanRanges = icaoRanges.filter((range) => {
    if (!range.startHex) return false;
    const startDec = parseInt(range.startHex, 16);
    return startDec >= 0x500000 && startDec < 0x600000;
  });

  console.log("\nEuropean ICAO allocations (50xxxx range):");
  europeanRanges.forEach((range) => {
    console.log(`${range.startHex}-${range.finishHex}: ${range.countryISO2}`);
  });

  // Check for Lithuania specifically
  const lithuanianRanges = icaoRanges.filter(
    (range) => range.countryISO2 === "LT"
  );
  console.log("\nLithuanian allocations:");
  lithuanianRanges.forEach((range) => {
    console.log(`${range.startHex}-${range.finishHex}: ${range.countryISO2}`);
  });
  // Test the specific ICAO codes
  const testCodes = ["503EC7", "480C1B"];

  testCodes.forEach((testIcao) => {
    const testDecimal = parseInt(testIcao, 16);
    console.log(`\nTesting ICAO ${testIcao} (decimal: ${testDecimal})`);

    const matchingRange = icaoRanges.find((range) => {
      const start = parseInt(range.startHex, 16);
      const end = parseInt(range.finishHex, 16);
      return testDecimal >= start && testDecimal <= end;
    });

    if (matchingRange) {
      console.log(
        `Found match: ${matchingRange.countryISO2} (${matchingRange.startHex}-${matchingRange.finishHex})`
      );
    } else {
      console.log("No matching range found!");
    }
  });
} catch (error) {
  console.error("Error:", error.message);
}
