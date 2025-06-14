import { AircraftCountryService } from "./src/app/services/aircraft-country.service";

// Manual test to verify the San Marino/Albania fix
const service = new AircraftCountryService();

console.log("Testing San Marino vs Albania ICAO hex mapping...\n");

// Test the original problematic case
console.log("Testing T7 registration (should be San Marino):");
const t7Result = service.getAircraftCountryDetailed("T7-ABC");
console.log(
  `Registration T7-ABC: ${t7Result.countryCode} (${t7Result.source}, confidence: ${t7Result.confidence})`
);

// Test San Marino ICAO hex range
console.log("\nTesting San Marino ICAO hex range:");
const smHexResult = service.getAircraftCountryDetailed(undefined, "500123");
console.log(
  `ICAO hex 500123: ${smHexResult.countryCode} (${smHexResult.source}, confidence: ${smHexResult.confidence})`
);
if (smHexResult.metadata?.icaoAllocation) {
  console.log(
    `  Allocation: ${smHexResult.metadata.icaoAllocation.countryName}`
  );
  console.log(`  Notes: ${smHexResult.metadata.icaoAllocation.notes}`);
}

// Test Albanian ICAO hex range
console.log("\nTesting Albanian ICAO hex range:");
const alHexResult = service.getAircraftCountryDetailed(undefined, "501123");
console.log(
  `ICAO hex 501123: ${alHexResult.countryCode} (${alHexResult.source}, confidence: ${alHexResult.confidence})`
);
if (alHexResult.metadata?.icaoAllocation) {
  console.log(
    `  Allocation: ${alHexResult.metadata.icaoAllocation.countryName}`
  );
}

// Test Norwegian case (the other problematic case)
console.log("\nTesting Norwegian ICAO hex (was incorrectly Italian):");
const noResult = service.getAircraftCountryDetailed(undefined, "4c1234");
console.log(
  `ICAO hex 4c1234: ${noResult.countryCode} (${noResult.source}, confidence: ${noResult.confidence})`
);

// Test comprehensive info
console.log("\nTesting comprehensive aircraft info:");
const comprehensiveInfo = service.getAircraftInfo("T7-ABC", "500123", "SM");
console.log(
  "Comprehensive result:",
  JSON.stringify(comprehensiveInfo, null, 2)
);
