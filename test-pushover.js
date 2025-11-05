// Test script to send a Pushover notification
// Usage: node test-pushover.js

const PUSHOVER_API_TOKEN = "a51thwyzvw24g3afcex6hf7xdnjfi9";
const PUSHOVER_USER_KEY = "u4h7b5hnvdgvozqd5yzm86i474fs4g";

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
