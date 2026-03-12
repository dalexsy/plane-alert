// Quick script to check device locations in Firestore
// Usage: node scripts/check-device-location.js <pushover-key>

const admin = require("firebase-admin");
const serviceAccount = require("../functions/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const pushoverKey = process.argv[2];

if (!pushoverKey) {
  console.error("Usage: node check-device-location.js <pushover-key>");
  process.exit(1);
}

async function checkDevices() {
  try {
    console.log(`Checking devices for key: ${pushoverKey.slice(0, 8)}...`);

    const collectionRef = db.collection("deviceTokens");
    const prefix = `${pushoverKey}__`;
    const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

    // Query all devices with this Pushover key
    const [fieldMatch, prefixMatch, legacyDoc] = await Promise.all([
      collectionRef.where("pushoverUserKey", "==", pushoverKey).get(),
      collectionRef
        .where(admin.firestore.FieldPath.documentId(), ">=", prefix)
        .where(admin.firestore.FieldPath.documentId(), "<", prefixEnd)
        .get(),
      collectionRef.doc(pushoverKey).get(),
    ]);

    const devices = new Map();

    for (const doc of fieldMatch.docs) {
      devices.set(doc.id, doc.data());
    }
    for (const doc of prefixMatch.docs) {
      devices.set(doc.id, doc.data());
    }
    if (legacyDoc.exists) {
      devices.set(legacyDoc.id, legacyDoc.data());
    }

    if (devices.size === 0) {
      console.log("No devices found for this key.");
      return;
    }

    console.log(`\nFound ${devices.size} device(s):\n`);

    for (const [docId, data] of devices.entries()) {
      const location = data.location || data.home;
      console.log(`Device ID: ${docId}`);
      console.log(`  Device Name: ${data.deviceName || "unknown"}`);
      console.log(`  Platform: ${data.platform || "unknown"}`);
      console.log(
        `  Location: ${
          location ? `${location.lat}, ${location.lon}` : "not set"
        }`,
      );
      console.log(`  Address: ${location?.address || "not set"}`);
      console.log(
        `  Legacy Home: ${
          data.home ? `${data.home.lat}, ${data.home.lon}` : "not set"
        }`,
      );
      console.log(`  Radius: ${data.radiusKm || 100} km`);
      console.log(`  Distance Unit: ${data.distanceUnit || "km"}`);
      console.log(
        `  Proximity Alerts: ${data.notifyProximity ? "enabled" : "disabled"}`,
      );
      console.log(
        `  Created: ${
          data.createdAt
            ? new Date(data.createdAt._seconds * 1000).toISOString()
            : "unknown"
        }`,
      );
      console.log(
        `  Updated: ${
          data.updatedAt
            ? new Date(data.updatedAt._seconds * 1000).toISOString()
            : "unknown"
        }`,
      );
      console.log("");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkDevices();
