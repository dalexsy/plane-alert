/**
 * Check all A7 aircraft to see if we can distinguish helicopters from gliders
 */

const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const RADIUS_NM = 200;

async function checkA7Aircraft() {
  const url = `https://api.adsb.one/v2/point/${BERLIN_LAT}/${BERLIN_LON}/${RADIUS_NM}`;

  console.log("🔍 Checking all A7 category aircraft...\n");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PlaneAlertDebug/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const aircraft = data.ac || [];

    const a7Aircraft = aircraft.filter((plane) => plane.category === "A7");

    console.log(`📊 Found ${a7Aircraft.length} aircraft with category A7\n`);
    console.log("=".repeat(80));

    a7Aircraft.forEach((plane) => {
      console.log(`\n${plane.hex} - ${(plane.flight || "N/A").trim()}`);
      console.log(`  Type (t): ${plane.t || "N/A"}`);
      console.log(`  Description: ${plane.desc || "N/A"}`);
      console.log(`  Registration: ${plane.r || "N/A"}`);
      console.log(`  Speed: ${plane.gs || "N/A"} kts`);
      console.log(
        `  Altitude: ${plane.alt_baro || plane.alt_geom || "N/A"} ft`
      );

      // Check if it looks like a helicopter based on type code
      const type = plane.t || "";
      const desc = plane.desc || "";
      const isHelicopter =
        /^(EC|AS|H\d|B\d{2,3}|UH|AH|CH|MI|S\d{2}|R\d{2}|NH\d{2}|MD\d{3})/i.test(
          type
        ) ||
        /helicopter|heli|copter|bell|sikorsky|eurocopter|airbus.*heli/i.test(
          desc
        );

      console.log(`  Helicopter: ${isHelicopter ? "✅ YES" : "❌ NO"}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 Conclusion:");
    console.log("   A7 includes BOTH helicopters and ultralights/gliders");
    console.log("   Must check TYPE CODE to distinguish:");
    console.log("   - Helicopter types: EC35, B06, B105, etc.");
    console.log("   - Glider types: FK9, BREZ, KP2, etc.");
    console.log("   \n   Solution: Check A7 category + helicopter type codes");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkA7Aircraft();
