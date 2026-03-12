const admin = require("./functions/node_modules/firebase-admin");
const serviceAccount = require("./functions/plane-alert-800ff-firebase-adminsdk-qbkr9-7f72fc50ad.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function clearCooldowns() {
  console.log("Clearing notification cooldowns...");

  const snapshot = await db.collection("notification-cooldowns").get();

  if (snapshot.empty) {
    console.log("No cooldowns to clear");
    return;
  }

  console.log(`Found ${snapshot.size} cooldown documents`);

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(
    "✅ All cooldowns cleared - next run will send fresh notifications",
  );
}

clearCooldowns()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
