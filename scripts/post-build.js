const fs = require('fs');
const path = require('path');

// Copy index.html to 200.html for Surge SPA routing
const distPath = path.join(__dirname, '../dist/plane-alert/browser');
const indexPath = path.join(distPath, 'index.html');
const fallbackPath = path.join(distPath, '200.html');

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, fallbackPath);
  console.log('✓ Created 200.html for Surge SPA routing');
} else {
  console.error('✗ index.html not found in dist/plane-alert/browser');
  process.exit(1);
}
