// Check what's in the aircraft-snapshots collection
const admin = require("firebase-admin");

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkAircraftData() {
  try {
    // Get the Berlin location document
    const docRef = db.collection("aircraft-snapshots").doc("52.46_13.52_100");
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log("Document does not exist");
      return;
    }

    const data = doc.data();

    console.log("\n=== Aircraft Snapshot Data ===");
    console.log("Aircraft count:", data.aircraft?.length || 0);
    console.log("History count:", Object.keys(data.history || {}).length);
    console.log(
      "Flight data count:",
      Object.keys(data.flightData || {}).length
    );
    console.log("Timestamp:", data.timestamp);

    // Check if aircraft have callsigns
    const aircraftWithCallsigns = (data.aircraft || []).filter(
      (ac) => ac.flight && ac.flight.trim()
    );
    console.log("\n=== Aircraft with Callsigns ===");
    console.log("Count:", aircraftWithCallsigns.length);

    if (aircraftWithCallsigns.length > 0) {
      console.log(
        "Sample callsigns:",
        aircraftWithCallsigns.slice(0, 5).map((ac) => ac.flight)
      );
    }

    // Show flightData if it exists
    if (data.flightData && Object.keys(data.flightData).length > 0) {
      console.log("\n=== Flight Data ===");
      console.log(JSON.stringify(data.flightData, null, 2));
    } else {
      console.log("\n=== No flight data found ===");
    }

    // Check flight-data-cache collection
    const cacheSnapshot = await db
      .collection("flight-data-cache")
      .limit(10)
      .get();
    console.log("\n=== Flight Data Cache ===");
    console.log("Cached entries:", cacheSnapshot.size);

    if (cacheSnapshot.size > 0) {
      cacheSnapshot.forEach((doc) => {
        console.log(
          `  ${doc.id}:`,
          doc.data().origin,
          "→",
          doc.data().destination
        );
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

checkAircraftData();
