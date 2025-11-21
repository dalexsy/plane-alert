/**
 * Check RAMBO3 (3EBB60) in ADS-B One API to see what flags it has
 * This will help us understand why it triggered backend notification
 */

const ICAO = "3EBB60"; // RAMBO3
const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const RADIUS_NM = 200;

async function checkRAMBO3() {
  const url = `https://api.adsb.one/v2/point/${BERLIN_LAT}/${BERLIN_LON}/${RADIUS_NM}`;

  console.log("🔍 Searching for RAMBO3 (3EBB60)...\n");
  console.log(`API: ${url}\n`);

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

    // Find RAMBO3
    const rambo3 = aircraft.find(
      (plane) => plane.hex.toUpperCase() === ICAO.toUpperCase()
    );

    if (rambo3) {
      console.log("\n✅ RAMBO3 FOUND!\n");
      console.log("=".repeat(80));
      console.log(`  ICAO: ${rambo3.hex}`);
      console.log(`  Callsign: ${rambo3.flight || "N/A"}`);
      console.log(`  Registration: ${rambo3.r || "N/A"}`);
      console.log(`  Type: ${rambo3.t || "N/A"}`);
      console.log(`  Description: ${rambo3.desc || "N/A"}`);
      console.log(
        `  mil flag: ${rambo3.mil} ${rambo3.mil === true ? "✅" : "❌"}`
      );
      console.log(
        `  dbFlags: ${rambo3.dbFlags} ${rambo3.dbFlags === 1 ? "✅" : "❌"}`
      );
      console.log(`  Category: ${rambo3.category || "N/A"}`);
      console.log(
        `  Altitude: ${rambo3.alt_baro || rambo3.alt_geom || "N/A"} ft`
      );
      console.log(`  Position: ${rambo3.lat}, ${rambo3.lon}`);
      console.log(`  Speed: ${rambo3.gs || "N/A"} kts`);
      console.log(`  Track: ${rambo3.track || "N/A"}°`);
      console.log("=".repeat(80));

      // Test with looksMilitary
      const { looksMilitary } = require("./shared/dist/cjs/military-detection");
      const isMilitary = looksMilitary(rambo3);

      console.log(
        `\n🎯 looksMilitary() result: ${
          isMilitary ? "✅ MILITARY" : "❌ NOT MILITARY"
        }`
      );

      if (!isMilitary && (rambo3.mil === true || rambo3.dbFlags === 1)) {
        console.log(
          "\n⚠️  WARNING: Aircraft has mil/dbFlags but was filtered as boring!"
        );
        console.log(`   Type "${rambo3.t}" is in BORING_AIRCRAFT_TYPES list`);
      }
    } else {
      console.log("\n❌ RAMBO3 NOT FOUND in current area");
      console.log("   (Aircraft may not be flying right now)\n");

      // Show military aircraft in area for comparison
      const militaryAircraft = aircraft.filter(
        (plane) => plane.mil === true || plane.dbFlags === 1
      );

      if (militaryAircraft.length > 0) {
        console.log(
          `\n📊 Military aircraft in area: ${militaryAircraft.length}`
        );
        militaryAircraft.slice(0, 5).forEach((plane) => {
          console.log(`\n  ${plane.hex} - ${plane.flight || "N/A"}`);
          console.log(
            `    Type: ${plane.t || "N/A"}, mil: ${plane.mil}, dbFlags: ${
              plane.dbFlags
            }`
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkRAMBO3();
