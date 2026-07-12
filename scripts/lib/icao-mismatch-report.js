function analyzeAircraft(icaoHex, registration, callsign, data, lookup) {
  const { icaoRanges, regPrefixes, operatorCallSigns } = data;
  const {
    findIcaoRange,
    getCountryFromRegistration,
    getCountryFromCallsign,
  } = lookup;

  console.log("=".repeat(60));
  console.log("ICAO COUNTRY MISMATCH ANALYSIS");
  console.log("=".repeat(60));
  console.log(`ICAO Hex: ${icaoHex}`);
  console.log(`Registration: ${registration || "N/A"}`);
  console.log(`Callsign: ${callsign || "N/A"}`);
  console.log("");

  const icaoRange = findIcaoRange(icaoHex, icaoRanges);
  console.log("ICAO HEX ANALYSIS:");
  if (icaoRange) {
    console.log(`  Range: ${icaoRange.startHex}-${icaoRange.finishHex}`);
    console.log(
      `  Decimal: ${icaoRange.icaoDecimal} (${icaoRange.startDec}-${icaoRange.finishDec})`,
    );
    console.log(`  Country: ${icaoRange.countryISO2}`);
    console.log(`  Military: ${icaoRange.isMilitary ? "Yes" : "No"}`);
  } else {
    console.log("  No ICAO range found - unknown allocation");
  }

  console.log("");

  const regResult = getCountryFromRegistration(registration, regPrefixes);
  console.log("REGISTRATION ANALYSIS:");
  if (regResult) {
    console.log(`  Prefix: ${regResult.prefix}`);
    console.log(`  Country: ${regResult.countryCode}`);
    console.log(`  Confidence: ${regResult.confidence}`);
  } else {
    console.log("  No registration prefix match found");
  }

  console.log("");

  const callsignResult = getCountryFromCallsign(callsign, operatorCallSigns);
  console.log("CALLSIGN ANALYSIS:");
  if (callsignResult) {
    console.log(`  Operator Code: ${callsign.substring(0, 3)}`);
    console.log(`  Country: ${callsignResult.countryCode}`);
    console.log(`  Operator: ${callsignResult.operator.name || "Unknown"}`);
    console.log(`  Confidence: ${callsignResult.confidence}`);
  } else {
    console.log("  No callsign operator match found");
  }

  console.log("");
  console.log("MISMATCH DETECTION:");

  const countries = new Set();
  if (icaoRange) countries.add(icaoRange.countryISO2);
  if (regResult) countries.add(regResult.countryCode);
  if (callsignResult) countries.add(callsignResult.countryCode);

  if (countries.size > 1) {
    console.log("  MISMATCH DETECTED!");
    console.log(
      `  Different countries found: ${Array.from(countries).join(", ")}`,
    );

    console.log("");
    console.log("RECOMMENDATIONS:");

    if (
      regResult &&
      icaoRange &&
      regResult.countryCode !== icaoRange.countryISO2
    ) {
      console.log(
        `  Registration suggests ${regResult.countryCode}, but ICAO range is ${icaoRange.countryISO2}`,
      );
      console.log(
        `  Consider if ICAO range ${icaoRange.startHex}-${icaoRange.finishHex} needs to be split`,
      );

      const countryRanges = icaoRanges.filter(
        (r) => r.countryISO2 === regResult.countryCode,
      );
      if (countryRanges.length > 0) {
        console.log(`  Other ${regResult.countryCode} ranges:`);
        countryRanges.forEach((range) => {
          console.log(
            `    - ${range.startHex}-${range.finishHex} (${range.startDec}-${range.finishDec})`,
          );
        });
      }
    }

    console.log("");
    console.log("DATA COLLECTION SUGGESTION:");
    console.log(`  {`);
    console.log(`    "icao": "${icaoHex}",`);
    console.log(`    "registration": "${registration || ""}",`);
    console.log(`    "callsign": "${callsign || ""}",`);
    console.log(
      `    "icaoCountry": "${icaoRange ? icaoRange.countryISO2 : "Unknown"}",`,
    );
    console.log(
      `    "regCountry": "${regResult ? regResult.countryCode : "Unknown"}",`,
    );
    console.log(
      `    "callsignCountry": "${callsignResult ? callsignResult.countryCode : "Unknown"}",`,
    );
    console.log(`    "timestamp": "${new Date().toISOString()}"`);
    console.log(`  }`);
  } else if (countries.size === 1) {
    console.log("  No mismatch detected - all sources agree");
  } else {
    console.log("  Insufficient data to determine mismatch");
  }

  console.log("=".repeat(60));
}

module.exports = { analyzeAircraft };
