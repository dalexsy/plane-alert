/**
 * Global ICAO Range Gap Analyzer
 *
 * This script analyzes the entire ICAO allocation space and identifies
 * significant gaps that could indicate missing country allocations.
 *
 * Unlike the European-focused version, this checks the entire 24-bit
 * ICAO address space for allocation gaps.
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
const { EXPECTED_EUROPEAN_COUNTRIES } = require('./lib/icao-expected-european-countries');

function analyzeGlobalGaps() {
  console.log("=== Global ICAO Allocation Gap Analysis ===\n");

  // Sort all ranges by start address
  const sortedRanges = currentRanges.sort(
    (a, b) => parseInt(a.startHex, 16) - parseInt(b.startHex, 16)
  );

  console.log(`Total ICAO ranges: ${sortedRanges.length}`);
  console.log(`Address space: 000000-FFFFFF (16,777,216 addresses)\n`);

  const gaps = [];
  let currentPos = 0x000000; // Start of ICAO address space
  const MAX_ADDRESS = 0xffffff; // End of ICAO address space

  sortedRanges.forEach((range, index) => {
    const rangeStart = parseInt(range.startHex, 16);
    const rangeEnd = parseInt(range.finishHex, 16);

    // Check for gap before this range
    if (currentPos < rangeStart) {
      const gapSize = rangeStart - currentPos;
      if (gapSize >= 0x1000) {
        // At least 4096 addresses (significant gap)
        gaps.push({
          start: currentPos,
          end: rangeStart - 1,
          size: gapSize,
          startHex: currentPos.toString(16).toUpperCase().padStart(6, "0"),
          endHex: (rangeStart - 1).toString(16).toUpperCase().padStart(6, "0"),
          region: getIcaoRegion(rangeStart),
          between:
            index === 0
              ? "start"
              : `${sortedRanges[index - 1].countryISO2} and ${
                  range.countryISO2
                }`,
        });
      }
    }

    currentPos = Math.max(currentPos, rangeEnd + 1);
  });

  // Check for gap at the end
  if (currentPos <= MAX_ADDRESS) {
    const gapSize = MAX_ADDRESS - currentPos + 1;
    if (gapSize >= 0x1000) {
      gaps.push({
        start: currentPos,
        end: MAX_ADDRESS,
        size: gapSize,
        startHex: currentPos.toString(16).toUpperCase().padStart(6, "0"),
        endHex: MAX_ADDRESS.toString(16).toUpperCase().padStart(6, "0"),
        region: "end",
        between: "last range and end",
      });
    }
  }

  console.log(`Found ${gaps.length} significant gaps (>= 4096 addresses):\n`);

  gaps.forEach((gap, index) => {
    const sizeKB = Math.floor(gap.size / 1024);
    const potentialCountries = Math.floor(gap.size / 0x400); // 1024 addresses per small country
    console.log(`Gap ${index + 1}: ${gap.startHex}-${gap.endHex}`);
    console.log(
      `  Size: ${gap.size.toLocaleString()} addresses (${sizeKB}K), ${potentialCountries} potential countries`
    );
    console.log(`  Region: ${gap.region}, Between: ${gap.between}\n`);
  });

  return gaps;
}

function getIcaoRegion(address) {
  // ICAO address space regions (approximate ranges)
  if (address >= 0x000000 && address <= 0x1fffff) return "Africa (AFI)";
  if (address >= 0x200000 && address <= 0x2fffff) return "South America (SAM)";
  if (address >= 0x300000 && address <= 0x4fffff) return "Europe (EUR/NAT)";
  if (address >= 0x500000 && address <= 0x5fffff)
    return "Europe/North Atlantic (EUR/NAT)";
  if (address >= 0x600000 && address <= 0x6fffff) return "Middle East (MID)";
  if (address >= 0x700000 && address <= 0x77ffff)
    return "Middle East/Asia (MID/ASIA)";
  if (address >= 0x780000 && address <= 0x7fffff) return "Asia Pacific (ASIA)";
  if (address >= 0x800000 && address <= 0x8fffff) return "Asia (ASIA)";
  if (address >= 0x900000 && address <= 0x9fffff) return "Pacific (PAC)";
  if (address >= 0xa00000 && address <= 0xbfffff) return "North America (NAM)";
  if (address >= 0xc00000 && address <= 0xdfffff) return "North America (NAM)";
  if (address >= 0xe00000 && address <= 0xffffff) return "South America (SAM)";

  return "Unknown";
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
  console.log("Global ICAO Range Gap Analyzer\n");
  console.log(
    "This tool analyzes the entire ICAO address space for significant allocation gaps.\n"
  );

  const gaps = analyzeGlobalGaps();

  if (gaps.length === 0) {
    console.log("✅ No significant gaps found in ICAO allocations!");
    return;
  }

  console.log("=== Gap Analysis Summary ===");
  console.log(
    `Found ${gaps.length} significant gaps that could indicate missing country allocations.`
  );

  // Group gaps by region
  const gapsByRegion = gaps.reduce((acc, gap) => {
    if (!acc[gap.region]) acc[gap.region] = [];
    acc[gap.region].push(gap);
    return acc;
  }, {});

  console.log("\nGaps by region:");
  Object.entries(gapsByRegion).forEach(([region, regionGaps]) => {
    const totalAddresses = regionGaps.reduce((sum, gap) => sum + gap.size, 0);
    console.log(
      `  ${region}: ${
        regionGaps.length
      } gaps, ${totalAddresses.toLocaleString()} addresses`
    );
  });

  console.log("\n=== Recommendations ===");
  console.log("1. Research official ICAO allocations for these gap regions");
  console.log("2. Check if countries in these regions are missing allocations");
  console.log("3. Update from official ICAO sources (Document 7910)");
  console.log(
    "4. Consider adding military or special allocations if applicable"
  );

  console.log("\n=== Top Investigation Targets ===");
  const sortedGaps = gaps.sort((a, b) => b.size - a.size);
  sortedGaps.slice(0, 5).forEach((gap, index) => {
    console.log(
      `${index + 1}. ${gap.startHex}-${
        gap.endHex
      } (${gap.size.toLocaleString()} addresses) - ${gap.region}`
    );
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeGlobalGaps,
  getIcaoRegion,
  EXPECTED_EUROPEAN_COUNTRIES,
};
