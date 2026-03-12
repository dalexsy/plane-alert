// Quick check script - you need to:
// 1. Go to: https://console.cloud.google.com/cloudscheduler?project=plane-alert-800ff
// 2. Check if the scheduled jobs are enabled (should show collectAircraftData and processPlanes)
// 3. Look for any error indicators
// 
// Alternative: Check billing
// 1. Go to: https://console.cloud.google.com/billing?project=plane-alert-800ff
// 2. Make sure billing is enabled and not exceeded

console.log("Cloud Scheduler URL:");
console.log("https://console.cloud.google.com/cloudscheduler?project=plane-alert-800ff");
console.log("");
console.log("Cloud Functions Logs URL:");
console.log("https://console.cloud.google.com/functions/list?project=plane-alert-800ff");
console.log("");
console.log("Billing URL:");
console.log("https://console.cloud.google.com/billing?project=plane-alert-800ff");
console.log("");
console.log("Last known update: 2026-01-21T22:51:02 UTC (3 days ago)");
console.log("Current time: ~2026-01-24");
console.log("");
console.log("=== QUICK FIX ===");
console.log("If Cloud Scheduler jobs are paused/disabled, re-enable them in the console.");
console.log("If billing is the issue, you may need to upgrade or wait for quota reset.");
console.log("");
console.log("To redeploy functions and potentially fix the issue:");
console.log("  npm run deploy:functions");
