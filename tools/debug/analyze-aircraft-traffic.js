// Analyze actual aircraft traffic patterns from Firestore
const admin = require("../../functions/node_modules/firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(
  __dirname,
  "..",
  "galaxy",
  "plane-alert-800ff-firebase-adminsdk-8tgav-00c8aae60f.json"
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function analyzeTraffic() {
  console.log("📊 Analyzing aircraft traffic patterns...\n");

  // 1. Check flight-data-cache to see what's been fetched
  console.log("=== FLIGHT DATA CACHE ANALYSIS ===");
  const cacheSnapshot = await db.collection("flight-data-cache").get();

  const militaryFlights = [];
  const commercialFlights = [];
  const noDataFlights = [];

  cacheSnapshot.forEach((doc) => {
    const data = doc.data();
    const callsign = doc.id;

    if (data.noData) {
      noDataFlights.push(callsign);
    } else if (data.origin || data.destination) {
      // Has route data - check if it looks military
      const isMilitary =
        /^(RCH|DOOM|EXXON|EVAC|ANGRY|SPAR|REACH|COBRA|VIPER)/i.test(callsign) ||
        /^[A-Z]{3}\d{2,4}$/.test(callsign); // Military pattern like RCH123

      if (isMilitary) {
        militaryFlights.push({
          callsign,
          origin: data.originIata || data.origin,
          dest: data.destinationIata || data.destination,
          cachedAt: new Date(data.cachedAt).toISOString(),
        });
      } else {
        commercialFlights.push({
          callsign,
          origin: data.originIata || data.origin,
          dest: data.destinationIata || data.destination,
          cachedAt: new Date(data.cachedAt).toISOString(),
        });
      }
    }
  });

  console.log(`Total cached entries: ${cacheSnapshot.size}`);
  console.log(`  - Military flights: ${militaryFlights.length}`);
  console.log(`  - Commercial flights: ${commercialFlights.length}`);
  console.log(`  - No data: ${noDataFlights.length}\n`);

  if (militaryFlights.length > 0) {
    console.log("Sample military flights:");
    militaryFlights.slice(0, 10).forEach((f) => {
      console.log(
        `  ${f.callsign}: ${f.origin} → ${f.dest} (cached: ${f.cachedAt})`
      );
    });
    console.log();
  }

  if (commercialFlights.length > 0) {
    console.log("Sample commercial flights:");
    commercialFlights.slice(0, 10).forEach((f) => {
      console.log(
        `  ${f.callsign}: ${f.origin} → ${f.dest} (cached: ${f.cachedAt})`
      );
    });
    console.log();
  }

  // 2. Check AeroAPI stats
  console.log("=== AEROAPI USAGE STATS ===");
  const statsSnapshot = await db.collection("aeroapi-stats").get();

  const stats = [];
  statsSnapshot.forEach((doc) => {
    stats.push({
      date: doc.id,
      calls: doc.data().calls || 0,
    });
  });

  stats.sort((a, b) => a.date.localeCompare(b.date));

  if (stats.length > 0) {
    console.log("Daily API call history:");
    stats.forEach((s) => {
      console.log(
        `  ${s.date}: ${s.calls} calls ($${(s.calls * 0.005).toFixed(2)})`
      );
    });

    const totalCalls = stats.reduce((sum, s) => sum + s.calls, 0);
    console.log(
      `\nTotal calls tracked: ${totalCalls} ($${(totalCalls * 0.005).toFixed(
        2
      )})`
    );
  } else {
    console.log("No stats data found");
  }
  console.log();

  // 3. Check aircraft-snapshots to see what actually flies over
  console.log("=== RECENT AIRCRAFT SNAPSHOTS ===");
  const snapshotsSnapshot = await db
    .collection("aircraft-snapshots")
    .limit(5)
    .get();

  if (!snapshotsSnapshot.empty) {
    snapshotsSnapshot.forEach((doc) => {
      const data = doc.data();
      const locationKey = doc.id;
      const aircraft = data.aircraft || [];

      const withCallsigns = aircraft.filter((a) => a.flight && a.flight.trim());
      const militaryCount = aircraft.filter((a) => {
        const flags = String(a.dbFlags || "").toLowerCase();
        return flags.includes("military") || flags.includes("mil");
      }).length;

      console.log(`Location: ${locationKey}`);
      console.log(`  Total aircraft: ${aircraft.length}`);
      console.log(`  With callsigns: ${withCallsigns.length}`);
      console.log(`  Military: ${militaryCount}`);
      console.log(
        `  Updated: ${
          data.timestamp ? new Date(data.timestamp).toISOString() : "unknown"
        }`
      );

      if (militaryCount > 0) {
        const militaryAircraft = aircraft.filter((a) => {
          const flags = String(a.dbFlags || "").toLowerCase();
          return flags.includes("military") || flags.includes("mil");
        });
        console.log(
          `  Military callsigns: ${militaryAircraft
            .map((a) => a.flight)
            .filter(Boolean)
            .join(", ")}`
        );
      }
      console.log();
    });
  } else {
    console.log("No snapshot data found");
  }

  process.exit(0);
}

analyzeTraffic().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
