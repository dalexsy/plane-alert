const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const zlib = require("zlib");

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

// Bump service worker cache name on every build so clients refresh reliably
const swPath = path.join(distPath, "sw.js");
if (fs.existsSync(swPath)) {
  let buildId = String(Date.now());
  try {
    buildId = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // ignore; fallback to timestamp
  }

  const sw = fs.readFileSync(swPath, "utf8");
  const next = sw.replace(
    /const\s+CACHE_NAME\s*=\s*"plane-alert-[^"]+"\s*;/,
    `const CACHE_NAME = "plane-alert-${buildId}";`
  );

  if (next !== sw) {
    fs.writeFileSync(swPath, next);
    console.log(`✓ Updated sw.js CACHE_NAME to plane-alert-${buildId}`);
  } else {
    console.warn("⚠ sw.js CACHE_NAME not updated (pattern not found)");
  }
}

// Gzip large JSON files to fix ERR_INCOMPLETE_CHUNKED_ENCODING on Surge
const assetsPath = path.join(distPath, "assets");
const largeJsonFiles = ["basic-ac-db1.json", "basic-ac-db2.json"];

console.log("🗜️  Compressing large JSON files...");
largeJsonFiles.forEach((filename) => {
  const filePath = path.join(assetsPath, filename);
  const gzipPath = filePath + ".gz";

  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const gzipBuffer = zlib.gzipSync(fileBuffer, { level: 9 });
    fs.writeFileSync(gzipPath, gzipBuffer);

    const originalSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
    const compressedSize = (gzipBuffer.length / 1024 / 1024).toFixed(2);
    const ratio = ((1 - gzipBuffer.length / fileBuffer.length) * 100).toFixed(1);

    console.log(
      `✓ ${filename}: ${originalSize}MB → ${compressedSize}MB (${ratio}% smaller)`
    );
  }
});
