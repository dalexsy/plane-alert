/**
 * Test new push notification format
 * Format: "over [location] to the [bearing from user] flying [plane heading] • [callsign] • [speed] • [altitude]"
 */

const {
  formatNotificationBody,
} = require("./shared/dist/cjs/notification-formatter");

console.log("📱 Testing New Push Notification Format\n");
console.log(
  'Format: "over [location] to the [bearing] flying [heading] • [callsign] • [speed] • [altitude]"'
);
console.log("=".repeat(80));

const testCases = [
  {
    name: "Full information (location + bearings)",
    data: {
      callsign: "GAF123",
      icao: "3f1234",
      direction: "SSW",
      bearing: 206,
      planeHeading: 315,
      flagEmoji: "🇩🇪",
      operator: "German Air Force",
      speed: 450,
      speedUnit: "km/h",
      altitude: 8500,
      altitudeUnit: "m",
      location: "Brandenburg",
    },
  },
  {
    name: "With vertical rate (climbing)",
    data: {
      callsign: "JOKER28",
      icao: "3f9f90",
      direction: "NW",
      bearing: 315,
      planeHeading: 180,
      flagEmoji: "🇩🇪",
      speed: 120,
      speedUnit: "km/h",
      altitude: 600,
      altitudeUnit: "m",
      verticalRate: 500,
      location: "Potsdam",
    },
  },
  {
    name: "No location (only bearings)",
    data: {
      callsign: "BAF42",
      icao: "4b1234",
      direction: "E",
      bearing: 90,
      planeHeading: 270,
      flagEmoji: "🇧🇪",
      speed: 350,
      speedUnit: "km/h",
      altitude: 6000,
      altitudeUnit: "m",
    },
  },
  {
    name: "US units (mph and feet)",
    data: {
      callsign: "USAF001",
      icao: "ae1234",
      direction: "N",
      bearing: 0,
      planeHeading: 45,
      flagEmoji: "🇺🇸",
      operator: "US Air Force",
      speed: 280,
      speedUnit: "mph",
      altitude: 28000,
      altitudeUnit: "ft",
      location: "Washington DC",
    },
  },
  {
    name: "No plane heading (only bearing from user)",
    data: {
      callsign: "RAF101",
      icao: "43c123",
      direction: "SW",
      bearing: 225,
      flagEmoji: "🇬🇧",
      speed: 320,
      speedUnit: "km/h",
      altitude: 7500,
      altitudeUnit: "m",
      location: "London",
    },
  },
];

console.log("\nTest Results:\n");

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`  Input data:`, JSON.stringify(test.data, null, 2));
  const result = formatNotificationBody(test.data);
  console.log(`  Result: ${result}`);
  console.log();
});

console.log("=".repeat(80));
console.log("\n💡 Format Explanation:");
console.log('   • "over [location]" - where the plane is');
console.log(
  '   • "to the [bearing]" - direction from YOUR location to the plane'
);
console.log('   • "flying [heading]" - direction the plane is heading');
console.log("   • Then: callsign, operator, speed, altitude");
console.log(
  '\nExample: "over Berlin to the NW ↖ flying SE ↘ • 🇩🇪 GAF123 • 450 km/h • 8,500 m"'
);
console.log(
  "         = Plane is over Berlin, northwest of you, and heading southeast"
);
