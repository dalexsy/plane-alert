// Test the operator matching logic
import { OPERATOR_SYMBOLS } from "../src/app/config/operator-symbols.config";

// Test plane objects
const testPlanes = [
  {
    operator: "United States Navy",
    country: "US",
    isMilitary: true,
    expected: "US_Navy",
  },
  {
    operator: "US Navy",
    country: "US",
    isMilitary: true,
    expected: "US_Navy",
  },
  {
    operator: "United States Air Force",
    country: "US",
    isMilitary: true,
    expected: "US_Air_Force",
  },
  {
    operator: "Some Random Airline",
    country: "US",
    isMilitary: true,
    expected: "US_Air_Force", // Should fall back to country-based matching
  },
  {
    operator: "Some Random Airline",
    country: "DE",
    isMilitary: true,
    expected: "bundeswehr_kreuz", // Should fall back to country-based matching
  },
];

// Test function (simulating the service logic)
function getSymbolConfig(plane) {
  const country = plane.country?.toLowerCase();
  const operator = plane.operator?.toLowerCase();

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
      return operatorMatch;
    }
  }

  // Fall back to country-based matching
  if (country) {
    return OPERATOR_SYMBOLS.find((cfg) => cfg.countries.includes(country));
  }

  return null;
}

// Run tests
console.log("Testing operator matching logic:");
testPlanes.forEach((testPlane, index) => {
  const result = getSymbolConfig(testPlane);
  const success = result?.key === testPlane.expected;
  console.log(`Test ${index + 1}: ${success ? "PASS" : "FAIL"}`);
  console.log(`  Operator: "${testPlane.operator}"`);
  console.log(`  Country: "${testPlane.country}"`);
  console.log(`  Expected: "${testPlane.expected}"`);
  console.log(`  Got: "${result?.key || "null"}"`);
  console.log("");
});
