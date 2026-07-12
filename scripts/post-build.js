const fs = require("fs");
const path = require("path");

// Pi/nginx SPA fallback uses try_files → /index.html (not Surge's 200.html).
const distPath = path.join(__dirname, "../dist/plane-alert/browser");

if (!fs.existsSync(path.join(distPath, "index.html"))) {
  console.error("[fail] index.html not found in dist/plane-alert/browser");
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
  console.log("[info] Synced auth-probe favicon assets to dist");
}

const indexPath = path.join(distPath, "index.html");
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace(
    /<link rel="stylesheet" href="(styles-[^"]+\.css)" media="print" onload="this\.media='all'">/,
    '<link rel="stylesheet" href="$1">',
  );
  html = html.replace(
    /<link rel="preload" href="(https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/flag-icon-css[^"]+)" as="style">/,
    '<link rel="stylesheet" href="$1">',
  );
  fs.writeFileSync(indexPath, html);
}

const stampScript = path.join(__dirname, "../../directory/scripts/stamp-dist-git-source.mjs");
if (fs.existsSync(stampScript)) {
  const { execSync } = require("child_process");
  execSync(`node "${stampScript}" --dist="${distPath}" --repo="${path.join(__dirname, "..")}"`, {
    stdio: "inherit",
  });
}
