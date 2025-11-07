// Test script to send a Pushover notification
// Usage: PUSHOVER_API_TOKEN=xxx PUSHOVER_USER_KEY=yyy node test-pushover.js
// Or create a .env file with these values

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;
const PUSHOVER_USER_KEY = process.env.PUSHOVER_USER_KEY;

if (!PUSHOVER_API_TOKEN || !PUSHOVER_USER_KEY) {
  console.error("❌ ERROR: Missing environment variables!");
  console.error("Please set PUSHOVER_API_TOKEN and PUSHOVER_USER_KEY");
  console.error("\nUsage:");
  console.error(
    "  PUSHOVER_API_TOKEN=xxx PUSHOVER_USER_KEY=yyy node test-pushover.js"
  );
  console.error("\nOr create a .env file in the root directory with:");
  console.error("  PUSHOVER_API_TOKEN=your_token_here");
  console.error("  PUSHOVER_USER_KEY=your_user_key_here");
  process.exit(1);
}

async function testPushover() {
  console.log("Testing Pushover notification...");

  const params = new URLSearchParams({
    token: PUSHOVER_API_TOKEN,
    user: PUSHOVER_USER_KEY,
    title: "Test Military Plane Alert",
    message:
      "This is a test notification from your plane alert system. If you receive this, Pushover is working correctly!",
    url: "https://plane-alert.surge.sh/",
    url_title: "View on Map",
    priority: "1",
    sound: "intermission",
  });

  try {
    const response = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const result = await response.json();

    if (response.ok && result.status === 1) {
      console.log("✅ SUCCESS! Notification sent successfully!");
      console.log("Request ID:", result.request);
      console.log("\nCheck your phone/device for the notification.");
    } else {
      console.error("❌ FAILED! Pushover returned an error:");
      console.error(result);
    }
  } catch (error) {
    console.error("❌ ERROR sending notification:");
    console.error(error);
  }
}

testPushover();
