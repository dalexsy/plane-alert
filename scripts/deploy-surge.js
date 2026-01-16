const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const shouldBuild = !args.includes("--skip-build");

if (shouldBuild) {
  console.log("🏗️  Building (fresh dist) before deploy...");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Build failed; aborting deploy.");
    process.exit(1);
  }
  console.log("");
}

// Validate deployment directory
const deployPath = path.join(__dirname, "../dist/plane-alert/browser");

console.log("🔍 Validating deployment directory...");

// Check if directory exists
if (!fs.existsSync(deployPath)) {
  console.error("❌ ERROR: Deployment directory does not exist!");
  console.error(`   Expected: ${deployPath}`);
  console.error("   Run 'npm run build' first.");
  process.exit(1);
}

// Check for required files
const requiredFiles = ["index.html", "200.html", "favicon.ico"];
const missingFiles = requiredFiles.filter(
  (file) => !fs.existsSync(path.join(deployPath, file))
);

if (missingFiles.length > 0) {
  console.error("❌ ERROR: Missing required files:");
  missingFiles.forEach((file) => console.error(`   - ${file}`));
  console.error("   Run 'npm run build' to generate all files.");
  process.exit(1);
}

// Check for main JavaScript files (should have hashed names)
const files = fs.readdirSync(deployPath);
const hasMainJs = files.some((f) => f.startsWith("main-") && f.endsWith(".js"));
const hasPolyfills = files.some(
  (f) => f.startsWith("polyfills-") && f.endsWith(".js")
);

if (!hasMainJs || !hasPolyfills) {
  console.error("❌ ERROR: Missing compiled JavaScript files!");
  console.error("   The build may have failed or be incomplete.");
  console.error("   Run 'npm run build' again.");
  process.exit(1);
}

console.log("✅ Deployment directory validated");
console.log(`   Path: ${deployPath}`);
console.log(`   Files found: ${files.length}`);
console.log("");

// Deploy to Surge
console.log("🚀 Deploying to Surge...");
try {
  execSync(`surge "${deployPath}" plane-alert.surge.sh`, {
    stdio: "inherit",
    cwd: deployPath,
  });
  console.log("");
  console.log("✅ Deployment successful!");
  console.log("   URL: https://plane-alert.surge.sh");
} catch (error) {
  console.error("❌ Deployment failed!");
  process.exit(1);
}
