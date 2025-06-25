// scripts/merge-icao-ranges.js
// Usage: node scripts/merge-icao-ranges.js
// This script reads the hex-only ICAO country ranges JSON, merges consecutive /24 blocks sharing the same countryISO2, isMilitary flag, and significantBitmask into larger contiguous ranges, and overwrites the file with merged entries.

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

    // Convert hex to integer and sort
    const entries = data.map((item) => ({
      start: parseInt(item.startHex, 16),
      end: parseInt(item.finishHex, 16),
      countryISO2: item.countryISO2,
      isMilitary: item.isMilitary,
      significantBitmask: item.significantBitmask,
    }));
    entries.sort((a, b) => a.start - b.start);

    // Merge consecutive ranges with same properties
    const merged = [];
    for (const entry of entries) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.countryISO2 === entry.countryISO2 &&
        last.isMilitary === entry.isMilitary &&
        last.significantBitmask === entry.significantBitmask &&
        entry.start === last.end + 1
      ) {
        // Extend the last range
        last.end = entry.end;
      } else {
        merged.push({ ...entry });
      }
    }

    // Convert back to hex JSON structure
    const slim = merged.map((item) => ({
      startHex: item.start.toString(16).toUpperCase().padStart(6, "0"),
      finishHex: item.end.toString(16).toUpperCase().padStart(6, "0"),
      isMilitary: item.isMilitary,
      countryISO2: item.countryISO2,
      significantBitmask: item.significantBitmask,
    }));

    // Write back
    await fs.writeFile(filePath, JSON.stringify(slim, null, 2));
    console.log(
      `Merged ICAO ranges: reduced from ${data.length} to ${slim.length} entries.`
    );
  } catch (err) {
    console.error("Error merging ICAO ranges:", err);
    process.exit(1);
  }
})();
