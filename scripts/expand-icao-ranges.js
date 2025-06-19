const fs = require("fs");
const path = require("path");

const srcAtdbPath = path.resolve(
  __dirname,
  "../src/assets/data/icao-country-ranges-atdb.json"
);
const outputPath = path.resolve(
  __dirname,
  "../src/assets/data/icao-country-ranges.json"
);

function padHex(num) {
  return num.toString(16).toUpperCase().padStart(6, "0");
}

function expandRanges() {
  const data = JSON.parse(fs.readFileSync(srcAtdbPath, "utf8"));
  const expanded = [];

  data.forEach((range) => {
    for (let dec = range.startDec; dec <= range.finishDec; dec += 256) {
      const startDec = dec;
      const finishDec = Math.min(dec + 255, range.finishDec);
      expanded.push({
        startHex: padHex(startDec),
        finishHex: padHex(finishDec),
        startDec,
        finishDec,
        isMilitary: range.isMilitary,
        countryISO2: range.countryISO2,
        significantBitmask: "FFFF00",
      });
    }
  });

  // Write sorted by startDec
  expanded.sort((a, b) => a.startDec - b.startDec);
  fs.writeFileSync(outputPath, JSON.stringify(expanded, null, 2), "utf8");
  console.log(
    `Expanded ${data.length} ranges into ${expanded.length} /24 blocks and saved to icao-country-ranges.json`
  );
}

expandRanges();
