// Send a test notification to Galaxy S24
const https = require("https");

const token = process.env.PUSHOVER_API_TOKEN;
const user = process.env.PUSHOVER_USER_KEY;
const device = process.env.PUSHOVER_DEVICE || "galaxys24";
const message = process.env.PUSHOVER_MESSAGE || "Plane Alert test message";
const title = process.env.PUSHOVER_TITLE || "Plane Alert";

if (!token || !user) {
  console.error("❌ ERROR: Missing environment variables!");
  console.error("Please set PUSHOVER_API_TOKEN and PUSHOVER_USER_KEY");
  console.error("\nOptional:");
  console.error("  PUSHOVER_DEVICE=galaxys24");
  console.error('  PUSHOVER_MESSAGE="hello"');
  console.error('  PUSHOVER_TITLE="Plane Alert"');
  process.exit(1);
}

const params = new URLSearchParams({
  token,
  user,
  message,
  device,
  title,
  priority: "0",
});

const data = params.toString();

const options = {
  hostname: "api.pushover.net",
  path: "/1/messages.json",
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": Buffer.byteLength(data),
  },
};

console.log("💌 Sending notification to Galaxy S24...");

const req = https.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log("\n✅ Response:", responseData);
    try {
      const parsed = JSON.parse(responseData);
      if (parsed.status === 1) {
        console.log("📱 Notification sent successfully!");
      } else {
        console.log("❌ Failed:", parsed);
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
