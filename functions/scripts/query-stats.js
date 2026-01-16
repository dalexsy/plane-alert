const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "plane-alert-800ff",
  });
}

const db = admin.firestore();

async function queryStats() {
  console.log("=== AEROAPI STATS ===");
  const stats = await db
    .collection("aeroapi-stats")
    .orderBy(admin.firestore.FieldPath.documentId())
    .get();
  stats.forEach((doc) => {
    const data = doc.data();
    console.log(
      `${doc.id}: ${data.calls} calls ($${(data.calls * 0.005).toFixed(2)})`
    );
  });

  const totalCalls = stats.docs.reduce(
    (sum, doc) => sum + (doc.data().calls || 0),
    0
  );
  console.log(
    `\nTotal: ${totalCalls} calls ($${(totalCalls * 0.005).toFixed(2)})\n`
  );

  console.log("=== FLIGHT DATA CACHE ===");
  const cache = await db.collection("flight-data-cache").limit(1000).get();
  console.log(`Total cached entries: ${cache.size}`);

  const withData = cache.docs.filter((doc) => !doc.data().noData);
  const noData = cache.docs.filter((doc) => doc.data().noData);

  console.log(`  With route data: ${withData.length}`);
  console.log(`  No data found: ${noData.length}\n`);

  console.log("Sample cached flights:");
  withData.slice(0, 20).forEach((doc) => {
    const data = doc.data();
    console.log(
      `  ${doc.id}: ${data.originIata || data.origin || "?"} → ${
        data.destinationIata || data.destination || "?"
      }`
    );
  });

  process.exit(0);
}

queryStats().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
