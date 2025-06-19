/**
 * Script to help update ICAO country ranges with better data sources
 *
 * This script provides multiple options to get better ICAO allocation data:
 * 1. Manual verification of known problem ranges
 * 2. Links to authoritative sources
 * 3. Community-maintained databases
 */

console.log("🛩️  ICAO Range Update Helper");
console.log("============================");

// Known problematic ranges that need fixing
const KNOWN_ISSUES = [
  {
    icao: "464A91",
    decimal: 4606609,
    callsign: "OHU609",
    currentMapping: "IT (Italy)",
    expectedMapping: "FI (Finland)",
    reason: "OH- registration prefix indicates Finnish aircraft",
    range: "440000-47FFFF",
    issue: "Range too broad - may need splitting",
  },
  {
    icao: "480C1B",
    decimal: 4721691,
    callsign: "NAF15",
    currentMapping: "PL (Poland)",
    expectedMapping: "NL (Netherlands)",
    reason: "NAF = Netherlands Air Force",
    range: "480000-48FFFF",
    issue: "Military aircraft using non-standard allocation",
  },
];

console.log("\n📋 Known Issues to Fix:");
console.log("========================");

KNOWN_ISSUES.forEach((issue, index) => {
  console.log(`\n${index + 1}. ICAO ${issue.icao} (${issue.callsign})`);
  console.log(`   Current: ${issue.currentMapping}`);
  console.log(`   Expected: ${issue.expectedMapping}`);
  console.log(`   Reason: ${issue.reason}`);
  console.log(`   Range: ${issue.range}`);
  console.log(`   Issue: ${issue.issue}`);
});

console.log("\n🔗 Recommended Data Sources:");
console.log("=============================");
console.log("1. OpenSky Network - https://opensky-network.org/");
console.log("   - Has REST API for ICAO allocations");
console.log("   - Rate limited but could fetch once and cache");
console.log("");
console.log("2. FlightRadar24 Community Data");
console.log("   - Community-maintained ICAO allocations");
console.log("   - Often more accurate for edge cases");
console.log("");
console.log("3. ADS-B Exchange Data");
console.log("   - Real-world verification of ICAO allocations");
console.log("   - Good for spotting misallocated ranges");
console.log("");
console.log("4. Aviation Forums & Communities");
console.log("   - RadarBox community forums");
console.log("   - FlightAware developer discussions");

console.log("\n🛠️  Manual Fix Recommendations:");
console.log("=================================");
console.log("For immediate fixes, update your icao-country-ranges.json:");
console.log("");
console.log("1. Split the Italian range 440000-47FFFF:");
console.log("   - Keep 440000-463FFF for Italy");
console.log("   - Create 464000-467FFF for Finland (if data supports)");
console.log("   - Research actual allocation boundaries");
console.log("");
console.log("2. Check military aircraft allocations:");
console.log("   - Military may use non-standard ranges");
console.log("   - Consider adding isMilitary flag usage");
console.log("   - Cross-reference with official air force data");

console.log("\n✅ Next Steps:");
console.log("===============");
console.log("1. Research the specific ranges that are causing issues");
console.log("2. Cross-reference with multiple sources");
console.log("3. Update icao-country-ranges.json with corrections");
console.log("4. Test with known problematic aircraft");
console.log("5. Consider adding data source attribution");

console.log("\n🎯 Your current system is now fixed to prioritize:");
console.log("===================================================");
console.log("1. Registration prefixes (most reliable)");
console.log("2. ICAO hex ranges (fallback)");
console.log("3. No API dependency (unreliable)");
console.log("\nThis should resolve most country detection issues!");
