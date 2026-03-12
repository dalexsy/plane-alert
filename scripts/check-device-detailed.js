// Detailed device location checker
// Usage: node scripts/check-device-detailed.js <pushover-key>

const admin = require("firebase-admin");
const serviceAccount = require("../functions/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const pushoverKey = process.argv[2];

if (!pushoverKey) {
  console.error("Usage: node scripts/check-device-detailed.js <pushover-key>");
  process.exit(1);
}

async function checkDevices() {
  try {
    console.log(
      `\n🔍 Checking devices for key: ${pushoverKey.slice(0, 8)}...\n`,
    );

    const collectionRef = db.collection("deviceTokens");
    const prefix = `${pushoverKey}__`;
    const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

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
      console.log("❌ No devices found for this key.");
      return;
    }

    console.log(`✅ Found ${devices.size} device(s):\n`);

    for (const [docId, data] of devices.entries()) {
      const location = data.location;
      const home = data.home;
      const effectiveLocation = location || home;

      console.log(`📱 Device: ${data.deviceName || "unknown"}`);
      console.log(`   Doc ID: ${docId}`);
      console.log(`   Platform: ${data.platform || "unknown"}`);

      // Check both location fields
      if (location) {
        console.log(`   ✓ Location field: ${location.lat}, ${location.lon}`);
        console.log(`     Address: ${location.address || "NOT SET"}`);
      } else {
        console.log(`   ✗ Location field: NOT SET`);
      }

      if (home) {
        console.log(`   ⚠️  Legacy Home field: ${home.lat}, ${home.lon}`);
        console.log(`     Address: ${home.address || "NOT SET"}`);
      } else {
        console.log(`   ✓ Legacy Home field: NOT SET (good)`);
      }

      if (effectiveLocation) {
        const lat = effectiveLocation.lat;
        const lon = effectiveLocation.lon;
        console.log(`   📍 Effective Location: ${lat}, ${lon}`);

        // Determine rough city based on coordinates
        if (lat > 52 && lat < 53 && lon > 13 && lon < 14) {
          console.log(`   🏙️  Location appears to be: BERLIN`);
        } else if (lat > 48 && lat < 49 && lon > 11 && lon < 12) {
          console.log(`   🏙️  Location appears to be: MUNICH`);
        } else {
          console.log(`   🏙️  Location: UNKNOWN CITY`);
        }
      }

      console.log(`   Radius: ${data.radiusKm || 100} km`);
      console.log(
        `   Proximity: ${data.notifyProximity ? "enabled" : "disabled"}`,
      );
      console.log(
        `   Updated: ${
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
