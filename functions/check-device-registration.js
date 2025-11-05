const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkDeviceRegistration() {
  const snapshot = await db.collection("deviceRegistrations").get();

  console.log(`📱 Found ${snapshot.size} registered device(s)\n`);

  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log("─".repeat(80));
    console.log(`Device ID: ${doc.id}`);
    console.log(`Pushover User Key: ${data.pushoverUserKey}`);
    console.log(`Home Location: ${JSON.stringify(data.home, null, 2)}`);
    console.log(`Radius: ${data.radiusKm || 100} km`);
    console.log(`Distance Unit: ${data.distanceUnit || "km"}`);
    console.log(`Platform: ${data.platform || "N/A"}`);
    console.log(`Last Notified: ${JSON.stringify(data.lastNotified, null, 2)}`);
    console.log("─".repeat(80));
    console.log();
  });

  process.exit(0);
}

checkDeviceRegistration().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
