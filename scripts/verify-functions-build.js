const { execSync } = require("child_process");
const path = require("path");
const functionsDir = path.join(__dirname, "..", "functions");
const criticalModules = [
  "lib/index.js",
  "lib/services/build-military-notification.js",
  "lib/services/collect-military-notifications.js",
  "lib/services/notify-for-device.js",
  "lib/services/deliver-device-notifications.js",
  "lib/services/kiosk-alert-sound.js",
  "lib/services/kiosk-alert-remote.js",
  "lib/services/kiosk-alert-local.js",
  "lib/services/notification-health.js",
  "lib/notification-processor.js",
  "lib/notification-health-watchdog.js",
];
console.log("Verifying functions build...");
execSync("npm run build", { cwd: functionsDir, stdio: "inherit" });
for (const rel of criticalModules) {
  const abs = path.join(functionsDir, rel);
  try {
    require(abs);
    console.log("  ok " + rel);
  } catch (error) {
    console.error("  fail " + rel);
    console.error(error?.message || error);
    process.exit(1);
  }
}
console.log("Functions build verified");