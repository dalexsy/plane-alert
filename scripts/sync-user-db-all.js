/**
 * Sync user aircraft database to ALL deployment targets
 * - Backend: functions/src/data/user-aircraft-db.json
 * - Frontend: src/assets/user-aircraft-db.json
 *
 * Run before any deployment to ensure consistency
 */

const fs = require("fs");
const path = require("path");

const sourceFile = path.join(__dirname, "..", "user-aircraft-db-auto.json");
const targets = [
  {
    name: "Backend (Functions)",
    path: path.join(
      __dirname,
      "..",
      "functions",
      "src",
      "data",
      "user-aircraft-db.json"
    ),
  },
  {
    name: "Frontend (Assets)",
    path: path.join(__dirname, "..", "src", "assets", "user-aircraft-db.json"),
  },
];

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

  console.log(
    `\n🔄 Syncing user aircraft database (${aircraftCount} aircraft)...`
  );
  console.log(`   Source: ${sourceFile}\n`);

  // Sync to all targets
  let syncedCount = 0;
  for (const target of targets) {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(target.path);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy file
      fs.writeFileSync(target.path, sourceData, "utf8");
      console.log(`   ✅ ${target.name}`);
      console.log(`      → ${target.path}`);
      syncedCount++;
    } catch (error) {
      console.error(`   ❌ ${target.name}: ${error.message}`);
    }
  }

  console.log(`\n✅ Synced to ${syncedCount}/${targets.length} targets\n`);

  if (syncedCount < targets.length) {
    process.exit(1);
  }
} catch (error) {
  console.error("\n❌ Failed to sync user aircraft database:", error.message);
  process.exit(1);
}
