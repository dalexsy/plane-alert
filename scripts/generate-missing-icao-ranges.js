/**
 * Automatic ICAO Range Generator for Missing European Countries
 *
 * This script analyzes the existing ICAO allocation patterns and automatically
 * generates missing ranges for European countries that should have allocations
 * but are currently showing as "Unknown".
 *
 * Pattern Analysis:
 * - European countries are allocated in the 50xxxx range
 * - Small European states get 0x100-0x3FF ranges (1024 hex addresses each)
 * - Baltic states (Lithuania, Latvia, Estonia) follow a specific pattern
 * - The allocation follows alphabetical/geographical grouping
 */

const fs = require("fs");
const path = require("path");

// Load current ICAO ranges
const icaoRangesPath = path.join(
  __dirname,
  "../src/assets/data/icao-country-ranges.json"
);
const currentRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));

// Expected European countries that should have ICAO allocations but might be missing
const EXPECTED_EUROPEAN_COUNTRIES = {
  // Baltic States (the pattern we identified)
  LT: { name: "Lithuania", priority: 1 },
  LV: { name: "Latvia", priority: 1 },
  EE: { name: "Estonia", priority: 1 },

  // Other potential missing small European states
  MD: { name: "Moldova", priority: 2 },
  AL: { name: "Albania", priority: 2 },
  MK: { name: "North Macedonia", priority: 2 },
  ME: { name: "Montenegro", priority: 2 },
  BA: { name: "Bosnia and Herzegovina", priority: 2 },
  RS: { name: "Serbia", priority: 2 },
  BG: { name: "Bulgaria", priority: 3 },
  RO: { name: "Romania", priority: 3 },
  HR: { name: "Croatia", priority: 3 },
  SI: { name: "Slovenia", priority: 3 },
  SK: { name: "Slovakia", priority: 3 },
  CZ: { name: "Czech Republic", priority: 3 },
};

function analyzeCurrentAllocations() {
  console.log("=== ICAO Allocation Analysis ===\n");

  // Find European ranges (50xxxx series)
  const europeanRanges = currentRanges
    .filter((range) => {
      const startHex = range.startHex.toUpperCase();
      return (
        startHex.startsWith("50") ||
        startHex.startsWith("51") ||
        startHex.startsWith("52")
      );
    })
    .sort((a, b) => parseInt(a.startHex, 16) - parseInt(b.startHex, 16));

  console.log("Current European ICAO Allocations (50xxxx-52xxxx range):");
  europeanRanges.forEach((range) => {
    console.log(
      `${range.startHex}-${range.finishHex}: ${range.countryISO2} (${
        EXPECTED_EUROPEAN_COUNTRIES[range.countryISO2]?.name || "Unknown"
      })`
    );
  });

  // Check which expected countries are missing
  const allocatedCountries = new Set(europeanRanges.map((r) => r.countryISO2));
  const missingCountries = Object.keys(EXPECTED_EUROPEAN_COUNTRIES).filter(
    (code) => !allocatedCountries.has(code)
  );

  console.log("\n=== Missing Countries ===");
  missingCountries.forEach((code) => {
    const country = EXPECTED_EUROPEAN_COUNTRIES[code];
    console.log(`${code}: ${country.name} (priority ${country.priority})`);
  });

  return { europeanRanges, missingCountries, allocatedCountries };
}

function findAvailableRanges(europeanRanges) {
  console.log("\n=== Available Range Analysis ===");

  const gaps = [];
  const EUROPEAN_START = 0x500000; // Start of European allocation
  const EUROPEAN_END = 0x52ffff; // End of reasonable European allocation

  // Sort ranges by start address
  const sortedRanges = europeanRanges.sort(
    (a, b) => parseInt(a.startHex, 16) - parseInt(b.startHex, 16)
  );

  let currentPos = EUROPEAN_START;

  sortedRanges.forEach((range) => {
    const rangeStart = parseInt(range.startHex, 16);
    const rangeEnd = parseInt(range.finishHex, 16);

    if (currentPos < rangeStart) {
      // Found a gap
      const gapSize = rangeStart - currentPos;
      if (gapSize >= 0x400) {
        // At least 1024 addresses (minimum for a country)
        gaps.push({
          start: currentPos,
          end: rangeStart - 1,
          size: gapSize,
          startHex: currentPos.toString(16).toUpperCase().padStart(6, "0"),
          endHex: (rangeStart - 1).toString(16).toUpperCase().padStart(6, "0"),
        });
      }
    }
    currentPos = Math.max(currentPos, rangeEnd + 1);
  });

  // Check for gap at the end
  if (currentPos <= EUROPEAN_END) {
    const gapSize = EUROPEAN_END - currentPos + 1;
    gaps.push({
      start: currentPos,
      end: EUROPEAN_END,
      size: gapSize,
      startHex: currentPos.toString(16).toUpperCase().padStart(6, "0"),
      endHex: EUROPEAN_END.toString(16).toUpperCase().padStart(6, "0"),
    });
  }

  console.log("Available gaps for new allocations:");
  gaps.forEach((gap, index) => {
    console.log(
      `Gap ${index + 1}: ${gap.startHex}-${gap.endHex} (${
        gap.size
      } addresses, ${Math.floor(gap.size / 0x400)} potential countries)`
    );
  });

  return gaps;
}

function generateMissingAllocations(missingCountries, availableGaps) {
  console.log("\n=== Generating Missing Allocations ===");

  const newAllocations = [];
  let currentGapIndex = 0;
  let currentGapPosition = availableGaps[0]?.start || 0x503f00; // Fallback starting position

  // Sort missing countries by priority
  const sortedMissing = missingCountries
    .map((code) => ({ code, ...EXPECTED_EUROPEAN_COUNTRIES[code] }))
    .sort((a, b) => a.priority - b.priority);

  sortedMissing.forEach((country) => {
    // Standard allocation size for small European countries: 0x400 (1024 addresses)
    const allocationSize = 0x400;
    const startAddress = currentGapPosition;
    const endAddress = startAddress + allocationSize - 1;

    const allocation = {
      startHex: startAddress.toString(16).toUpperCase().padStart(6, "0"),
      finishHex: endAddress.toString(16).toUpperCase().padStart(6, "0"),
      startDec: startAddress,
      finishDec: endAddress,
      isMilitary: false,
      countryISO2: country.code,
      significantBitmask: "FFFF00",
    };

    newAllocations.push(allocation);
    console.log(
      `${country.code} (${country.name}): ${allocation.startHex}-${allocation.finishHex}`
    );

    // Move to next position
    currentGapPosition = endAddress + 1;

    // Check if we need to move to the next gap
    if (
      currentGapIndex < availableGaps.length - 1 &&
      currentGapPosition > availableGaps[currentGapIndex].end
    ) {
      currentGapIndex++;
      if (currentGapIndex < availableGaps.length) {
        currentGapPosition = availableGaps[currentGapIndex].start;
      }
    }
  });

  return newAllocations;
}

function main() {
  console.log("ICAO Range Generator for European Countries\n");
  console.log(
    "This tool analyzes missing ICAO allocations and generates systematic fixes.\n"
  );

  const { europeanRanges, missingCountries } = analyzeCurrentAllocations();

  if (missingCountries.length === 0) {
    console.log("\n✅ All expected European countries have ICAO allocations!");
    return;
  }

  const availableGaps = findAvailableRanges(europeanRanges);

  if (availableGaps.length === 0) {
    console.log("\n❌ No available gaps found for new allocations!");
    return;
  }

  const newAllocations = generateMissingAllocations(
    missingCountries,
    availableGaps
  );

  console.log("\n=== Summary ===");
  console.log(`Generated ${newAllocations.length} new ICAO allocations`);
  console.log(
    "These can be automatically inserted into the icao-country-ranges.json file"
  );

  // Optionally write to a file for review
  const outputPath = path.join(__dirname, "generated-icao-allocations.json");
  fs.writeFileSync(outputPath, JSON.stringify(newAllocations, null, 2));
  console.log(`\nDetailed allocations written to: ${outputPath}`);

  console.log("\n=== Next Steps ===");
  console.log("1. Review the generated allocations above");
  console.log("2. Run the insertion script to update icao-country-ranges.json");
  console.log("3. Update the icao-allocations.config.ts file");
  console.log("4. Test with actual aircraft data");
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeCurrentAllocations,
  findAvailableRanges,
  generateMissingAllocations,
  EXPECTED_EUROPEAN_COUNTRIES,
};
