const fs = require("fs");
const path = require("path");

// Copy index.html to 200.html for Surge SPA routing
const distPath = path.join(__dirname, "../dist/plane-alert/browser");
const indexPath = path.join(distPath, "index.html");
const fallbackPath = path.join(distPath, "200.html");

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, fallbackPath);
  console.log("✓ Created 200.html for Surge SPA routing");
} else {
  console.error("✗ index.html not found in dist/plane-alert/browser");
  process.exit(1);
}

// Auth-gated nginx serves /assets/favicon/* without SSO — keep probe paths in dist.
const probeFiles = ["site.webmanifest", "favicon.ico"];
const publicProbeDir = path.join(__dirname, "../public/assets/favicon");
const distProbeDir = path.join(distPath, "assets/favicon");

if (fs.existsSync(publicProbeDir)) {
  fs.mkdirSync(distProbeDir, { recursive: true });
  for (const file of probeFiles) {
    const src = path.join(publicProbeDir, file);
    const dest = path.join(distProbeDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log("✓ Synced auth-probe favicon assets to dist");
}
