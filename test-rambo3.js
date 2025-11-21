/**
 * Test RAMBO3 (3EBB60) military detection
 * Verify that both frontend and backend now use the same looksMilitary() function
 */

const { looksMilitary } = require("./shared/dist/cjs/military-detection");

// Simulate RAMBO3 aircraft data from ADS-B API
const rambo3TestCases = [
  {
    name: "RAMBO3 with mil flag",
    plane: {
      hex: "3ebb60",
      flight: "RAMBO3",
      mil: true,
      t: "UNKNOWN",
    },
  },
  {
    name: "RAMBO3 with dbFlags",
    plane: {
      hex: "3ebb60",
      flight: "RAMBO3",
      dbFlags: 1,
      t: "UNKNOWN",
    },
  },
  {
    name: "RAMBO3 with mil flag but boring aircraft type",
    plane: {
      hex: "3ebb60",
      flight: "RAMBO3",
      mil: true,
      t: "C172", // Filtered as boring
    },
  },
  {
    name: "RAMBO3 without any flags",
    plane: {
      hex: "3ebb60",
      flight: "RAMBO3",
      t: "UNKNOWN",
    },
  },
];

console.log("🎯 Testing RAMBO3 Military Detection\n");
console.log("=".repeat(80));

rambo3TestCases.forEach((testCase, index) => {
  const result = looksMilitary(testCase.plane);
  const status = result ? "✅ MILITARY" : "❌ NOT MILITARY";

  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log(`  ICAO: ${testCase.plane.hex}`);
  console.log(`  Callsign: ${testCase.plane.flight || "N/A"}`);
  console.log(`  Type: ${testCase.plane.t || "N/A"}`);
  console.log(`  mil flag: ${testCase.plane.mil || false}`);
  console.log(`  dbFlags: ${testCase.plane.dbFlags || 0}`);
  console.log(`  Result: ${status}`);
});

console.log("\n" + "=".repeat(80));
console.log("\n💡 Key Insights:");
console.log(
  "  • looksMilitary() checks: (mil=true OR dbFlags=1) AND type NOT boring"
);
console.log(
  "  • Frontend and backend now use the SAME function from shared package"
);
console.log("  • Callsign prefix detection removed (error-prone)");
console.log(
  "  • If RAMBO3 has mil=true or dbFlags=1, it WILL show as military\n"
);
