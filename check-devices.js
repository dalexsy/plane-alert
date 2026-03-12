const https = require("https");

https
  .get(
    "https://firestore.googleapis.com/v1/projects/plane-alert-800ff/databases/(default)/documents/deviceTokens",
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const json = JSON.parse(data);
        console.log(
          "\nRegistered devices:",
          json.documents ? json.documents.length : 0,
        );

        if (json.documents && json.documents.length > 0) {
          console.log("\nDevices:");
          json.documents.forEach((doc, i) => {
            const id = doc.name.split("/").pop();
            const fields = doc.fields || {};
            const lat =
              fields.location?.geoPointValue?.latitude ||
              fields.lat?.doubleValue ||
              "N/A";
            const lon =
              fields.location?.geoPointValue?.longitude ||
              fields.lon?.doubleValue ||
              "N/A";
            const radius =
              fields.radiusKm?.integerValue ||
              fields.radiusKm?.doubleValue ||
              "N/A";
            console.log(`  ${i + 1}. ${id.substring(0, 30)}...`);
            console.log(`     Location: ${lat}, ${lon}`);
            console.log(`     Radius: ${radius} km`);
          });
        } else {
          console.log("\n⚠️  NO DEVICES REGISTERED!");
          console.log(
            "The Cloud Function will not run without registered devices.",
          );
          console.log("This explains why data is not updating.");
        }
      });
    },
  )
  .on("error", (err) => console.error("Error:", err));
