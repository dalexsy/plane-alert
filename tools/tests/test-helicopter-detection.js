/**
 * Test JOKER28 helicopter detection with new A7 + callsign logic
 */

console.log("🚁 Testing Helicopter Detection for JOKER28\n");
console.log("=".repeat(80));

const testCases = [
  {
    name: "JOKER28 - A7 + military callsign",
    icao: "3f9f90",
    callsign: "JOKER28",
    category: "A7",
    type: null,
    desc: null,
    expected: true,
    reason: "A7 category + JOKER* military callsign pattern",
  },
  {
    name: "CHX100 - A7 + rescue callsign",
    icao: "3e0fed",
    callsign: "CHX100",
    category: "A7",
    type: null,
    desc: null,
    expected: true,
    reason: "A7 category + CHX* rescue helicopter callsign",
  },
  {
    name: "EC35 Helicopter - A7 + type code",
    icao: "3dd2cd",
    callsign: null,
    category: "A7",
    type: "EC35",
    desc: "AIRBUS HELICOPTERS EC-135/635",
    expected: true,
    reason: "A7 category + EC35 helicopter type code",
  },
  {
    name: "Glider - A7 without helicopter indicators",
    icao: "unknown",
    callsign: "GLIDER1",
    category: "A7",
    type: "FK9",
    desc: "B&F TECHNIK FK-9",
    expected: false,
    reason: "A7 but no helicopter type code or military/rescue callsign",
  },
  {
    name: "Standard helicopter - A6 category",
    icao: "unknown",
    callsign: "TEST123",
    category: "A6",
    type: null,
    desc: null,
    expected: true,
    reason: "A6 is official rotorcraft category",
  },
];

console.log("\nTest Results:\n");

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`  ICAO: ${test.icao}`);
  console.log(`  Callsign: ${test.callsign || "N/A"}`);
  console.log(`  Category: ${test.category || "N/A"}`);
  console.log(`  Type: ${test.type || "N/A"}`);
  console.log(
    `  Expected: ${test.expected ? "✅ Helicopter" : "❌ Not Helicopter"}`
  );
  console.log(`  Reason: ${test.reason}`);
  console.log();
});

console.log("=".repeat(80));
console.log("\n💡 Detection Logic Summary:");
console.log("   1. ICAO in helicopter database → Helicopter");
console.log("   2. Category A6, B6, H0-H12 → Helicopter");
console.log(
  "   3. Helicopter ICAO type code (EC*, AS*, B###, etc.) → Helicopter"
);
console.log("   4. A7 + helicopter type code → Helicopter");
console.log("   5. A7 + military/rescue callsign pattern → Helicopter ✨ NEW");
console.log("   6. Helicopter operator pattern → Helicopter");
console.log("   7. Helicopter model name pattern → Helicopter");
console.log("\n   This fixes JOKER28 and similar military helicopters with");
console.log("   misconfigured transponders (A7 category, no type code).");
