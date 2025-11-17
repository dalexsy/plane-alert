const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

async function testProximityAlerts() {
  try {
    console.log("\n🧪 Testing proximity alerts for enabled devices...\n");

    const snapshot = await db.collection("deviceTokens").get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;

      console.log(`\n📱 Device: ${data.deviceName || docId}`);
      console.log(`   User Key: ${data.pushoverUserKey?.slice(0, 10)}...`);
      console.log(`   Proximity Enabled: ${data.notifyProximity}`);

      if (data.notifyProximity === true && data.pushoverUserKey) {
        console.log(`   ✅ SENDING TEST NOTIFICATION`);

        const params = {
          token: PUSHOVER_API_TOKEN || "",
          user: data.pushoverUserKey,
          device: data.deviceName || "",
          title: "✈️ TEST: Proximity Alert",
          message:
            "This is a test proximity notification to verify device targeting is working correctly.",
          url: "https://plane-alert.surge.sh/",
          url_title: "View App",
          priority: "1",
          sound: "none",
        };

        const response = await fetch(
          "https://api.pushover.net/1/messages.json",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(params),
          }
        );

        const result = await response.json();

        if (response.ok && result.status === 1) {
          console.log(
            `   ✅ Notification sent successfully to device: ${data.deviceName}`
          );
        } else {
          console.log(`   ❌ Failed to send: ${JSON.stringify(result)}`);
        }
      } else {
        console.log(`   ⏭️  SKIPPED (proximity disabled)`);
      }
    }

    console.log("\n✅ Test complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testProximityAlerts();
