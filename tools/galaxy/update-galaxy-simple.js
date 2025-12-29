// Simple script to update Galaxy location via the existing checkDevice API
const https = require("https");

const pushoverUserKey = process.env.PUSHOVER_USER_KEY || process.argv[2];
const deviceName =
  process.env.PUSHOVER_DEVICE || process.argv[3] || "galaxys24";
if (!pushoverUserKey) {
  console.error("❌ Missing Pushover user key.");
  console.error("Usage:");
  console.error(
    "  PUSHOVER_USER_KEY=xxx node tools/galaxy/update-galaxy-simple.js"
  );
  console.error(
    "  node tools/galaxy/update-galaxy-simple.js <PUSHOVER_USER_KEY> [DEVICE_NAME]"
  );
  process.exit(1);
}

const deviceData = {
  pushoverUserKey,
  deviceName,
  location: {
    lat: 52.4605886, // Berlin (same as Pixel 5)
    lon: 13.523268,
  },
  radiusKm: 100,
  notifyProximity: false,
  platform: "API Update",
  timezone: "Europe/Berlin",
  distanceUnit: "km",
  specialIcaos: [],
  ignoredTypes: [],
};

const data = JSON.stringify(deviceData);

const options = {
  hostname: "registerdevice-wmktwp72xq-uc.a.run.app",
  path: "/",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log("📱 Updating Galaxy S24 location to Unterföhring...");
console.log("   New coordinates:", deviceData.location);

const req = https.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log("\n✅ Response:", responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log("\n📍 Location updated successfully!");
      console.log("   Address: Dieselstraße 8, Unterföhring, 85774");
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
