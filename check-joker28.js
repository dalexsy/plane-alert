/**
 * Check JOKER28 (3F9F90) helicopter detection
 */

const ICAO = "3F9F90"; // JOKER28
const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const RADIUS_NM = 200;

async function checkJOKER28() {
  const url = `https://api.adsb.one/v2/point/${BERLIN_LAT}/${BERLIN_LON}/${RADIUS_NM}`;

  console.log("🔍 Searching for JOKER28 (3F9F90)...\n");

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

    console.log(`📊 Total aircraft: ${aircraft.length}`);

    const joker28 = aircraft.find(
      (plane) => plane.hex.toUpperCase() === ICAO.toUpperCase()
    );

    if (joker28) {
      console.log("\n✅ JOKER28 FOUND!\n");
      console.log("=".repeat(80));
      console.log(`  ICAO: ${joker28.hex}`);
      console.log(`  Callsign: ${joker28.flight || "N/A"}`);
      console.log(`  Registration: ${joker28.r || "N/A"}`);
      console.log(`  Type (t): ${joker28.t || "N/A"}`);
      console.log(`  Description (desc): ${joker28.desc || "N/A"}`);
      console.log(
        `  Category: ${joker28.category || "N/A"} ⭐ KEY FIELD FOR HELICOPTERS`
      );
      console.log(`  Type Description: ${joker28.type || "N/A"}`);
      console.log(
        `  Altitude: ${joker28.alt_baro || joker28.alt_geom || "N/A"} ft`
      );
      console.log(`  Position: ${joker28.lat}, ${joker28.lon}`);
      console.log(`  Speed: ${joker28.gs || "N/A"} kts`);
      console.log("=".repeat(80));

      // Check if category indicates helicopter
      const category = joker28.category;
      if (category) {
        const catUpper = String(category).trim().toUpperCase();
        const isHelicopterCategory =
          catUpper.startsWith("H") ||
          ["B6", "B7", "C3"].includes(catUpper) ||
          catUpper.includes("ROTOR") ||
          catUpper.includes("HELI") ||
          catUpper.includes("COPTER");

        console.log(
          `\n🚁 Category "${category}" indicates helicopter: ${
            isHelicopterCategory ? "✅ YES" : "❌ NO"
          }`
        );

        if (isHelicopterCategory) {
          console.log(
            "\n💡 ADS-B Exchange identifies helicopters using the category code!"
          );
          console.log(
            '   Category codes starting with "H" are rotorcraft (H0-H12)'
          );
          console.log("   Your helicopter detection already supports this.");
        }
      } else {
        console.log("\n⚠️  No category field in API response");
      }
    } else {
      console.log("\n❌ JOKER28 NOT FOUND in current area");
      console.log("   (Aircraft may have landed)\n");

      // Show helicopters in area
      const helicopters = aircraft.filter((plane) => {
        const cat = plane.category;
        if (!cat) return false;
        const catUpper = String(cat).trim().toUpperCase();
        return (
          catUpper.startsWith("H") || ["B6", "B7", "C3"].includes(catUpper)
        );
      });

      if (helicopters.length > 0) {
        console.log(`\n🚁 Helicopters in area: ${helicopters.length}`);
        helicopters.slice(0, 5).forEach((plane) => {
          console.log(`\n  ${plane.hex} - ${plane.flight || "N/A"}`);
          console.log(
            `    Type: ${plane.t || "N/A"}, Category: ${plane.category}`
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkJOKER28();
