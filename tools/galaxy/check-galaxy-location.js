// Check Galaxy location
const https = require("https");

const pushoverUserKey = process.env.PUSHOVER_USER_KEY || process.argv[2];
if (!pushoverUserKey) {
  console.error("❌ Missing Pushover user key.");
  console.error("Usage:");
  console.error(
    "  PUSHOVER_USER_KEY=xxx node tools/galaxy/check-galaxy-location.js"
  );
  console.error(
    "  node tools/galaxy/check-galaxy-location.js <PUSHOVER_USER_KEY>"
  );
  process.exit(1);
}

const checkData = {
  pushoverUserKey,
};

const data = JSON.stringify(checkData);

const options = {
  hostname: "checkdevice-wmktwp72xq-uc.a.run.app",
  path: "/",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log("📱 Checking Galaxy S24 location...");

const req = https.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    try {
      const parsed = JSON.parse(responseData);
      const galaxy = parsed.devices.find((d) => d.deviceName === "galaxys24");
      const pixel = parsed.devices.find((d) => d.deviceName === "pixel5");

      if (galaxy) {
        console.log("\n✅ Galaxy S24 location:");
        console.log("   Coordinates:", galaxy.config.location);
        console.log("   Radius:", galaxy.config.radiusKm, "km");
      } else {
        console.log("❌ Galaxy S24 not found");
      }

      if (pixel) {
        console.log("\n✅ Pixel 5 location:");
        console.log("   Coordinates:", pixel.config.location);
        console.log("   Radius:", pixel.config.radiusKm, "km");
      }
    } catch (e) {
      console.log("Response:", responseData);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error:", error);
});

req.write(data);
req.end();
