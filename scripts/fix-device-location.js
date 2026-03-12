// Fix device location script
// Usage: node scripts/fix-device-location.js <pushover-key> <device-name> <lat> <lon> <address>
// Example: node scripts/fix-device-location.js YOUR_KEY desktop 52.4606 13.5233 "Berlin, Germany"

const admin = require("firebase-admin");
const serviceAccount = require("../functions/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const [, , pushoverKey, deviceName, lat, lon, address] = process.argv;

if (!pushoverKey || !deviceName || !lat || !lon) {
  console.error("Usage: node scripts/fix-device-location.js <pushover-key> <device-name> <lat> <lon> [address]");
  console.error("Example: node scripts/fix-device-location.js YOUR_KEY desktop 52.4606 13.5233 \"Berlin, Germany\"");
  process.exit(1);
}

async function fixDeviceLocation() {
  try {
    console.log(`\n🔧 Fixing location for device: ${deviceName}\n`);

    const collectionRef = db.collection("deviceTokens");
    const prefix = `${pushoverKey}__`;
    const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

    const [fieldMatch, prefixMatch] = await Promise.all([
      collectionRef.where("pushoverUserKey", "==", pushoverKey).get(),
      collectionRef
        .where(admin.firestore.FieldPath.documentId(), ">=", prefix)
        .where(admin.firestore.FieldPath.documentId(), "<", prefixEnd)
        .get(),
    ]);

    let deviceDoc = null;
    
    for (const doc of fieldMatch.docs) {
      const data = doc.data();
      if (data.deviceName === deviceName) {
        deviceDoc = doc;
        break;
      }
    }
    
    if (!deviceDoc) {
      for (const doc of prefixMatch.docs) {
        const data = doc.data();
        if (data.deviceName === deviceName) {
          deviceDoc = doc;
          break;
        }
      }
    }

    if (!deviceDoc) {
      console.error(`❌ Device "${deviceName}" not found.`);
      process.exit(1);
    }

    const currentData = deviceDoc.data();
    console.log("📍 Current location:", JSON.stringify(currentData.location || currentData.home, null, 2));

    const newLocation = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      ...(address && { address })
    };

    console.log("📍 New location:", JSON.stringify(newLocation, null, 2));

    const updateData = {
      location: newLocation,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Remove legacy home field if it exists
    if (currentData.home) {
      updateData.home = admin.firestore.FieldValue.delete();
    }

    await deviceDoc.ref.update(updateData);

    console.log("\n✅ Location updated successfully!");
    console.log(`   Device: ${deviceName}`);
    console.log(`   Coordinates: ${lat}, ${lon}`);
    if (address) {
      console.log(`   Address: ${address}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

fixDeviceLocation();
