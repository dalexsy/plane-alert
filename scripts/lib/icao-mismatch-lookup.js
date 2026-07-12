const fs = require("fs");
const path = require("path");

function loadMismatchData(baseDir) {
  const icaoRangesPath = path.join(
    baseDir,
    "../src/assets/data/icao-country-ranges.json",
  );
  const regPrefixPath = path.join(
    baseDir,
    "../src/assets/data/registration-country-prefix.json",
  );
  const operatorCallSignsPath = path.join(
    baseDir,
    "../src/assets/operator-call-signs.json",
  );

  try {
    const icaoRanges = JSON.parse(fs.readFileSync(icaoRangesPath, "utf8"));
    const regPrefixes = JSON.parse(fs.readFileSync(regPrefixPath, "utf8"));
    const operatorCallSigns = fs.existsSync(operatorCallSignsPath)
      ? JSON.parse(fs.readFileSync(operatorCallSignsPath, "utf8"))
      : {};

    return { icaoRanges, regPrefixes, operatorCallSigns };
  } catch (error) {
    console.error("Error loading data files:", error.message);
    process.exit(1);
  }
}

function findIcaoRange(icaoHex, icaoRanges) {
  const icaoDecimal = parseInt(icaoHex, 16);

  const range = icaoRanges.find(
    (r) => icaoDecimal >= r.startDec && icaoDecimal <= r.finishDec,
  );

  return range ? { ...range, icaoDecimal } : null;
}

function getCountryFromRegistration(registration, regPrefixes) {
  if (!registration) return null;

  const reg = registration.trim().toUpperCase();
  const sortedPrefixes = Object.keys(regPrefixes).sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return {
        countryCode: regPrefixes[prefix],
        prefix,
        confidence: "high",
      };
    }
  }

  return null;
}

function getCountryFromCallsign(callsign, operatorCallSigns) {
  if (!callsign || !operatorCallSigns) return null;

  const cleanCallsign = callsign.trim().toUpperCase();
  const operatorCode = cleanCallsign.substring(0, 3);

  if (operatorCallSigns[operatorCode]) {
    return {
      countryCode: operatorCallSigns[operatorCode].country,
      operator: operatorCallSigns[operatorCode],
      confidence: "medium",
    };
  }

  return null;
}

module.exports = {
  loadMismatchData,
  findIcaoRange,
  getCountryFromRegistration,
  getCountryFromCallsign,
};
