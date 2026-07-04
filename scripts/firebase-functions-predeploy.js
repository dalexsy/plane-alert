const { execSync } = require("child_process");

function run(cmd, cwd) {
  execSync(cmd, { stdio: "inherit", cwd });
}

const resourceDir = process.env.RESOURCE_DIR;
if (!resourceDir) {
  console.error("❌ Missing RESOURCE_DIR; cannot predeploy functions build.");
  process.exit(1);
}

console.log(`🏗️  Firebase predeploy (functions): ${resourceDir}`);

run("node ../scripts/prepare-functions-shared.js", resourceDir);
run("node ../scripts/verify-functions-build.js", resourceDir);
