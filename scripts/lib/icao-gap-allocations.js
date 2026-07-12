const { EXPECTED_EUROPEAN_COUNTRIES } = require("./icao-expected-european-countries");

function findAvailableRanges(europeanRanges) {
  console.log("\n=== Available Range Analysis ===");

  const gaps = [];
  const EUROPEAN_START = 0x500000;
  const EUROPEAN_END = 0x52ffff;

  const sortedRanges = europeanRanges.sort(
    (a, b) => parseInt(a.startHex, 16) - parseInt(b.startHex, 16),
  );

  let currentPos = EUROPEAN_START;

  sortedRanges.forEach((range) => {
    const rangeStart = parseInt(range.startHex, 16);
    const rangeEnd = parseInt(range.finishHex, 16);

    if (currentPos < rangeStart) {
      const gapSize = rangeStart - currentPos;
      if (gapSize >= 0x400) {
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
      `Gap ${index + 1}: ${gap.startHex}-${gap.endHex} (${gap.size} addresses, ${Math.floor(gap.size / 0x400)} potential countries)`,
    );
  });

  return gaps;
}

function generateMissingAllocations(missingCountries, availableGaps) {
  console.log("\n=== Generating Missing Allocations ===");

  const newAllocations = [];
  let currentGapIndex = 0;
  let currentGapPosition = availableGaps[0]?.start || 0x503f00;

  const sortedMissing = missingCountries
    .map((code) => ({ code, ...EXPECTED_EUROPEAN_COUNTRIES[code] }))
    .sort((a, b) => a.priority - b.priority);

  sortedMissing.forEach((country) => {
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
      `${country.code} (${country.name}): ${allocation.startHex}-${allocation.finishHex}`,
    );

    currentGapPosition = endAddress + 1;

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

function printGapReport(gaps) {
  if (gaps.length === 0) {
    console.log("No significant gaps found in ICAO allocations!");
    return;
  }

  console.log("=== Gap Analysis Summary ===");
  console.log(
    `Found ${gaps.length} significant gaps that could indicate missing country allocations.`,
  );

  const gapsByRegion = gaps.reduce((acc, gap) => {
    if (!acc[gap.region]) acc[gap.region] = [];
    acc[gap.region].push(gap);
    return acc;
  }, {});

  console.log("\nGaps by region:");
  Object.entries(gapsByRegion).forEach(([region, regionGaps]) => {
    const totalAddresses = regionGaps.reduce((sum, gap) => sum + gap.size, 0);
    console.log(
      `  ${region}: ${regionGaps.length} gaps, ${totalAddresses.toLocaleString()} addresses`,
    );
  });

  console.log("\n=== Recommendations ===");
  console.log("1. Research official ICAO allocations for these gap regions");
  console.log("2. Check if countries in these regions are missing allocations");
  console.log("3. Update from official ICAO sources (Document 7910)");
  console.log("4. Consider adding military or special allocations if applicable");

  console.log("\n=== Top Investigation Targets ===");
  const sortedGaps = gaps.sort((a, b) => b.size - a.size);
  sortedGaps.slice(0, 5).forEach((gap, index) => {
    console.log(
      `${index + 1}. ${gap.startHex}-${gap.endHex} (${gap.size.toLocaleString()} addresses) - ${gap.region}`,
    );
  });
}

module.exports = {
  findAvailableRanges,
  generateMissingAllocations,
  printGapReport,
};
