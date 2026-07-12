const { EXPECTED_EUROPEAN_COUNTRIES } = require("./icao-expected-european-countries");
const { getIcaoRegion } = require("./icao-region");

function analyzeGlobalGaps(currentRanges) {
  console.log("=== Global ICAO Allocation Gap Analysis ===\n");

  const sortedRanges = currentRanges.sort(
    (a, b) => parseInt(a.startHex, 16) - parseInt(b.startHex, 16),
  );

  console.log(`Total ICAO ranges: ${sortedRanges.length}`);
  console.log(`Address space: 000000-FFFFFF (16,777,216 addresses)\n`);

  const gaps = [];
  let currentPos = 0x000000;
  const MAX_ADDRESS = 0xffffff;

  sortedRanges.forEach((range, index) => {
    const rangeStart = parseInt(range.startHex, 16);
    const rangeEnd = parseInt(range.finishHex, 16);

    if (currentPos < rangeStart) {
      const gapSize = rangeStart - currentPos;
      if (gapSize >= 0x1000) {
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
              : `${sortedRanges[index - 1].countryISO2} and ${range.countryISO2}`,
        });
      }
    }

    currentPos = Math.max(currentPos, rangeEnd + 1);
  });

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
    const potentialCountries = Math.floor(gap.size / 0x400);
    console.log(`Gap ${index + 1}: ${gap.startHex}-${gap.endHex}`);
    console.log(
      `  Size: ${gap.size.toLocaleString()} addresses (${sizeKB}K), ${potentialCountries} potential countries`,
    );
    console.log(`  Region: ${gap.region}, Between: ${gap.between}\n`);
  });

  return gaps;
}

module.exports = {
  analyzeGlobalGaps,
  getIcaoRegion,
  EXPECTED_EUROPEAN_COUNTRIES,
};
