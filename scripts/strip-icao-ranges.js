// scripts/strip-icao-ranges.js
// Usage: node scripts/strip-icao-ranges.js
// This script reads the full ICAO country ranges JSON, removes startDec/finishDec fields, and overwrites the file with a slimmed-down version.

const fs = require("fs").promises;
const path = require("path");

(async () => {
  try {
    const filePath = path.join(
      __dirname,
      "..",
      "src",
      "assets",
      "data",
      "icao-country-ranges.json"
    );
    const json = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(json);

    const slimmed = data.map(
      ({
        startHex,
        finishHex,
        isMilitary,
        countryISO2,
        significantBitmask,
      }) => ({
        startHex,
        finishHex,
        isMilitary,
        countryISO2,
        significantBitmask,
      })
    );

    await fs.writeFile(filePath, JSON.stringify(slimmed, null, 2));
    console.log(
      `Slimmed ICAO ranges: kept ${slimmed.length} entries, wrote back to ${filePath}`
    );
  } catch (err) {
    console.error("Error slimming ICAO ranges:", err);
    process.exit(1);
  }
})();
