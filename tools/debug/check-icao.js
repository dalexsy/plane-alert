// Check what the ADS-B API returns for a specific ICAO
const icao = process.argv[2] || "AE01D4"; // RC-135U Combat Sent

async function checkICAO() {
  console.log(`\n🔍 Checking ICAO: ${icao}\n`);

  const url = `https://api.adsb.one/v2/hex/${icao}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PlaneAlertTest/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const plane = data.ac?.[0];

    if (!plane) {
      console.log("❌ Aircraft not found or not currently transmitting");
      return;
    }

    console.log("📡 Raw API Response:");
    console.log("─".repeat(80));
    console.log(JSON.stringify(plane, null, 2));
    console.log("─".repeat(80));
    console.log("\n📊 Key Fields:");
    console.log(`  ICAO (hex): ${plane.hex}`);
    console.log(`  Flight/Callsign: ${plane.flight || "N/A"}`);
    console.log(`  Registration: ${plane.r || "N/A"}`);
    console.log(`  Type: ${plane.t || "N/A"}`);
    console.log(
      `  Military Flag (mil): ${plane.mil} ${plane.mil === true ? "✅" : "❌"}`
    );
    console.log(`  Category: ${plane.category || "N/A"}`);
    console.log(`  Altitude: ${plane.alt_baro || plane.alt_geom || "N/A"} ft`);
    console.log(`  Position: ${plane.lat}, ${plane.lon}`);
    console.log(`  Speed: ${plane.gs || "N/A"} kts`);
    console.log(`  Track: ${plane.track || "N/A"}°`);

    console.log("\n🎯 Detection Result:");
    const wouldBeDetectedMilitary = plane.mil === true || plane.dbFlags === 1;
    if (wouldBeDetectedMilitary) {
      console.log(
        `  ✅ Would be detected as military (mil=${
          plane.mil === true
        }, dbFlags=${plane.dbFlags})`
      );
    } else {
      console.log(
        `  ❌ Would NOT be detected as military (mil=${
          plane.mil === true
        }, dbFlags=${plane.dbFlags})`
      );
      console.log("  💡 This explains why you're not getting notifications!");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkICAO();
