// Debug operator matching logic
const OPERATOR_SYMBOLS = [
  {
    key: "de_air_force",
    countries: ["de"],
  },
  {
    key: "us_air_force",
    countries: ["us"],
    operators: ["united states air force", "us air force", "usaf"],
  },
  {
    key: "us_navy",
    countries: [],
    operators: [
      "united states navy",
      "us navy",
      "usn",
      "u.s. navy",
      "navy",
      "naval",
      "united states naval",
    ],
  },
  {
    key: "ch_air_force",
    countries: ["ch"],
    operators: ["swiss air force"],
  },
  {
    key: "gb_air_force",
    countries: ["gb"],
  },
  {
    key: "ua_air_force",
    countries: ["ua"],
  },
  {
    key: "fr_air_force",
    countries: ["fr"],
  },
  {
    key: "de_police",
    operators: ["Bundespolizei"],
    countries: ["de"],
  },
  {
    key: "adac",
    operators: ["DRF Luftrettung"],
  },
  {
    key: "nato",
    countries: [],
    operators: ["NATO"],
  },
  {
    key: "pl_air_force",
    countries: ["pl"],
  },
  {
    key: "kw_air_force",
    countries: ["kw"],
  },
];

function getSymbolConfig(plane) {
  const operator = (plane.operator || "").toLowerCase();
  const country = (plane.country || "").toLowerCase();

  console.log(
    `Processing: ${plane.icao}, operator: "${operator}", country: "${country}", isMilitary: ${plane.isMilitary}`
  );

  // First, try to match by specific operator name
  if (operator) {
    const operatorMatch = OPERATOR_SYMBOLS.find(
      (cfg) =>
        cfg.operators &&
        cfg.operators.some(
          (op) =>
            operator.includes(op.toLowerCase()) ||
            op.toLowerCase().includes(operator)
        )
    );
    if (operatorMatch) {
      console.log(`✓ Operator match: ${operatorMatch.key}`);
      return operatorMatch;
    }
  }

  // Fall back to country-based matching
  if (country) {
    const countryMatch = OPERATOR_SYMBOLS.find((cfg) =>
      cfg.countries?.includes(country)
    );
    if (countryMatch) {
      console.log(`✓ Country match: ${countryMatch.key}`);
      return countryMatch;
    }
  }

  console.log(`✗ No match found`);
  return null;
}

// Test cases that demonstrate the problem
const testPlanes = [
  {
    icao: "3C6444",
    operator: "Lufthansa",
    country: "de",
    isMilitary: false,
    expected: "Should NOT show German military logo",
  },
  {
    icao: "4B1234",
    operator: "Swiss International Air Lines",
    country: "ch",
    isMilitary: false,
    expected: "Should NOT show Swiss military logo",
  },
  {
    icao: "AE1234",
    operator: "United States Navy",
    country: "us",
    isMilitary: true,
    expected: "Should show US Navy logo",
  },
  {
    icao: "GAF123",
    operator: "German Air Force",
    country: "de",
    isMilitary: true,
    expected: "Should show German Air Force logo",
  },
];

console.log("=== CURRENT BROKEN LOGIC ===");
testPlanes.forEach((plane) => {
  console.log(`\n${plane.expected}:`);
  const result = getSymbolConfig(plane);
  console.log(`Result: ${result ? result.key : "none"}`);
});
