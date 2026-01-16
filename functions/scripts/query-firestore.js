// Query Firestore using REST API (no auth needed for public collections)
const https = require("https");

const projectId = "plane-alert-800ff";

function query(collection, limit = 1000) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=${limit}`;

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function analyzeData() {
  console.log("=== AEROAPI STATS ===\n");

  const stats = await query("aeroapi-stats");

  if (stats.documents) {
    const sorted = stats.documents.sort((a, b) => a.name.localeCompare(b.name));
    let total = 0;

    sorted.forEach((doc) => {
      const date = doc.name.split("/").pop();
      const calls = doc.fields?.calls?.integerValue || 0;
      total += parseInt(calls);
      console.log(`${date}: ${calls} calls ($${(calls * 0.005).toFixed(2)})`);
    });

    console.log(`\nTotal: ${total} calls ($${(total * 0.005).toFixed(2)})\n`);
  } else {
    console.log("No stats found\n");
  }

  console.log("=== FLIGHT DATA CACHE ===\n");

  const cache = await query("flight-data-cache", 1000);

  if (cache.documents) {
    console.log(`Total cached: ${cache.documents.length} entries`);

    const withData = cache.documents.filter(
      (doc) => !doc.fields?.noData?.booleanValue
    );
    const noData = cache.documents.filter(
      (doc) => doc.fields?.noData?.booleanValue
    );

    console.log(`  With route data: ${withData.length}`);
    console.log(`  No data: ${noData.length}\n`);

    if (withData.length > 0) {
      console.log("Sample flights with route data:");
      withData.slice(0, 30).forEach((doc) => {
        const callsign = doc.name.split("/").pop();
        const origin =
          doc.fields?.originIata?.stringValue ||
          doc.fields?.origin?.stringValue ||
          "?";
        const dest =
          doc.fields?.destinationIata?.stringValue ||
          doc.fields?.destination?.stringValue ||
          "?";
        console.log(`  ${callsign}: ${origin} → ${dest}`);
      });
    }
  } else {
    console.log("No cache data found");
  }
}

analyzeData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
