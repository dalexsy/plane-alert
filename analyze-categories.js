/**
 * Find all aircraft with different category codes to understand the categories
 */

const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const RADIUS_NM = 200;

async function analyzeCategoryCodes() {
  const url = `https://api.adsb.one/v2/point/${BERLIN_LAT}/${BERLIN_LON}/${RADIUS_NM}`;

  console.log("🔍 Analyzing aircraft category codes...\n");

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

    console.log(`📊 Total aircraft: ${aircraft.length}\n`);

    // Group by category
    const categoryMap = new Map();

    aircraft.forEach((plane) => {
      const cat = plane.category || "NO_CATEGORY";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat).push({
        hex: plane.hex,
        flight: plane.flight?.trim() || "N/A",
        t: plane.t || "N/A",
        desc: plane.desc || "N/A",
      });
    });

    // Sort by category
    const sorted = Array.from(categoryMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    console.log("Category Distribution:");
    console.log("=".repeat(80));

    sorted.forEach(([category, planes]) => {
      console.log(`\n${category} (${planes.length} aircraft)`);

      // Show first 3 examples
      planes.slice(0, 3).forEach((plane) => {
        console.log(
          `  ${plane.hex} - ${plane.flight.padEnd(10)} Type: ${plane.t.padEnd(
            8
          )} Desc: ${plane.desc}`
        );
      });

      if (planes.length > 3) {
        console.log(`  ... and ${planes.length - 3} more`);
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 ADS-B Category Codes:");
    console.log(
      "   A0-A7 = Airplane (A0=no info, A1=light, A2=small, A3=large, A4=heavy vortex, A5=high performance, A6=rotorcraft, A7=glider/sailplane/ultralight)"
    );
    console.log("   B0-B7 = Airplane (different emitter types)");
    console.log("   C0-C7 = Ground vehicles, rotorcraft, etc.");
    console.log("   A6 and B6 are specifically ROTORCRAFT/HELICOPTER codes");
    console.log(
      "   \n   ⚠️  A7 is NOT helicopter - it's glider/sailplane/ultralight!"
    );
    console.log(
      "   \n   ADS-B Exchange must use a different detection method (ICAO database?)"
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

analyzeCategoryCodes();
