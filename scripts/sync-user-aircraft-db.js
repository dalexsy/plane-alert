/**
 * Sync user aircraft database from root to functions/src/data
 * Run before deploying functions to ensure backend has latest user-added aircraft
 */

const fs = require("fs");
const path = require("path");

const sourceFile = path.join(__dirname, "..", "user-aircraft-db-auto.json");
const targetFile = path.join(
  __dirname,
  "..",
  "functions",
  "src",
  "data",
  "user-aircraft-db.json"
);

try {
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.log("⚠️  No user-aircraft-db-auto.json found - skipping sync");
    process.exit(0);
  }

  // Read and validate source file
  const sourceData = fs.readFileSync(sourceFile, "utf8");
  const parsed = JSON.parse(sourceData);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid format: expected JSON array");
  }

  const aircraftCount = parsed.length - 1; // Subtract 1 for metadata object

  // Ensure target directory exists
  const targetDir = path.dirname(targetFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy file
  fs.writeFileSync(targetFile, sourceData, "utf8");

  console.log(`✅ Synced user aircraft database: ${aircraftCount} aircraft`);
  console.log(`   ${sourceFile}`);
  console.log(`   → ${targetFile}`);
} catch (error) {
  console.error("❌ Failed to sync user aircraft database:", error.message);
  process.exit(1);
}
