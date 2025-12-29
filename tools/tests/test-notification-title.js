/**
 * Test notification title formatting
 * Format: "[flag] [model]" if model exists, otherwise "[flag] [callsign]"
 */

const {
  formatNotificationTitle,
  getCountryFlagEmoji,
} = require("@plane-alert/shared");

console.log("📱 Testing Notification Title Format\n");
console.log(
  'Format: "[flag] [model]" if model exists, otherwise "[flag] [callsign]"'
);
console.log("=".repeat(80));

const testCases = [
  {
    name: "With model (preferred)",
    flagEmoji: "🇩🇪",
    model: "Airbus A400M Atlas",
    callsign: "GAF123",
    icao: "3f1234",
  },
  {
    name: "Without model, with callsign",
    flagEmoji: "🇩🇪",
    model: undefined,
    callsign: "JOKER28",
    icao: "3f9f90",
  },
  {
    name: "No model or callsign, just ICAO",
    flagEmoji: "🇩🇪",
    model: undefined,
    callsign: undefined,
    icao: "3e1bef",
  },
  {
    name: "With empty model string (should use callsign)",
    flagEmoji: "🇺🇸",
    model: "  ",
    callsign: "VIPER01",
    icao: "ae0406",
  },
  {
    name: "Unknown country",
    flagEmoji: getCountryFlagEmoji("Unknown"),
    model: "Boeing C-17 Globemaster III",
    callsign: "RCH123",
    icao: "ae1234",
  },
];

console.log("\nTest Results:");
console.log("-".repeat(80));

testCases.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log(
    `   Input: flag=${test.flagEmoji}, model="${test.model || ""}", callsign="${
      test.callsign || ""
    }", icao="${test.icao}"`
  );

  const title = formatNotificationTitle(
    test.flagEmoji,
    test.model,
    test.callsign,
    test.icao
  );

  console.log(`   ✅ Title: "${title}"`);
});

console.log("\n" + "=".repeat(80));
console.log("\n✅ All title formatting tests completed!\n");

// Compare old vs new approach
console.log("Old approach example (verbose):");
console.log('  "German Military" (when no model known)');
console.log("\nNew approach example (concise):");
console.log('  "🇩🇪 JOKER28" (uses flag + callsign)');
console.log("\nSpace saved: ~8 characters per notification\n");
