const admin = require("firebase-admin");

// Use default credentials (same as deployed functions)
admin.initializeApp();

const db = admin.firestore();

async function checkDevices() {
  try {
    const snapshot = await db.collection("deviceTokens").get();

    console.log("\n📱 FIRESTORE DEVICE DATA:\n");

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Device ID: ${doc.id}`);
      console.log(`  deviceName: ${data.deviceName}`);
      console.log(
        `  pushoverUserKey: ${data.pushoverUserKey?.slice(0, 10)}...`
      );
      console.log(`  notifyProximity: ${data.notifyProximity}`);
      console.log(`  radiusKm: ${data.radiusKm}`);
      console.log(`  ignoredTypes: ${JSON.stringify(data.ignoredTypes || [])}`);
      console.log(
        `  updatedAt: ${data.updatedAt?.toDate?.() || data.updatedAt}`
      );
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDevices();
