/**
 * Browser Console Helper for ICAO Mismatch Detection
 *
 * Paste this code into your browser console when viewing aircraft data
 * to quickly analyze ICAO/country mismatches.
 */

const {
  findIcaoCountry,
  findRegistrationCountry,
} = require("./lib/browser-icao-lookup.js");

function analyzeIcaoMismatch(icaoHex, registration, callsign) {
  console.log(
    "%c🛩️ ICAO MISMATCH ANALYSIS",
    "font-size: 16px; font-weight: bold; color: #2196F3;",
  );
  console.log("━".repeat(50));
  console.log(
    `ICAO: ${icaoHex} | Registration: ${registration || "N/A"} | Callsign: ${
      callsign || "N/A"
    }`,
  );

  const icaoResult = findIcaoCountry(icaoHex);
  const regResult = findRegistrationCountry(registration);

  console.log("\n📡 ICAO Allocation:");
  if (icaoResult) {
    console.log(`  Range: ${icaoResult.range} → ${icaoResult.country}`);
    console.log(`  Decimal: ${icaoResult.decimal}`);
  } else {
    console.log("  ❌ Unknown ICAO range");
  }

  console.log("\n🏷️ Registration:");
  if (regResult) {
    console.log(`  Prefix: ${regResult.prefix} → ${regResult.country}`);
  } else {
    console.log("  ❌ Unknown registration prefix");
  }

  if (icaoResult && regResult && icaoResult.country !== regResult.country) {
    console.log(
      "\n%c⚠️ MISMATCH DETECTED!",
      "color: #FF9800; font-weight: bold;",
    );
    console.log(`   ICAO suggests: ${icaoResult.country}`);
    console.log(`   Registration suggests: ${regResult.country}`);
    console.log("\n💡 Actions:");
    console.log(`   1. Report this mismatch`);
    console.log(`   2. Check if ICAO range needs updating`);
    console.log(`   3. Consider special cases (military, lease, etc.)`);

    const reportData = {
      icao: icaoHex,
      registration: registration || "",
      callsign: callsign || "",
      icaoCountry: icaoResult.country,
      regCountry: regResult.country,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    console.log("\n📋 Copy this data for reporting:");
    console.log(JSON.stringify(reportData, null, 2));

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(JSON.stringify(reportData, null, 2))
        .then(() => console.log("✅ Report data copied to clipboard!"))
        .catch(() => console.log("❌ Could not copy to clipboard"));
    }
  } else if (icaoResult && regResult) {
    console.log(
      "\n%c✅ No mismatch detected",
      "color: #4CAF50; font-weight: bold;",
    );
  } else {
    console.log("\n%c❓ Insufficient data for comparison", "color: #9E9E9E;");
  }

  console.log("━".repeat(50));
}

function analyzePlaneFromPage() {
  console.log("🔍 Attempting to extract aircraft data from page...");

  let icao = null;
  const urlMatch = window.location.href.match(/icao=([A-Fa-f0-9]+)/i);
  if (urlMatch) {
    icao = urlMatch[1].toUpperCase();
  }

  let registration = null;
  let callsign = null;

  const regSelectors = [
    '[title*="registration"]',
    ".registration",
    "#registration",
    ".tail-number",
    "[data-registration]",
  ];

  const callsignSelectors = [
    ".call-sign",
    ".callsign",
    '[title*="callsign"]',
    ".flight-number",
    "[data-callsign]",
  ];

  for (const selector of regSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      registration = element.textContent.trim();
      break;
    }
  }

  for (const selector of callsignSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      callsign = element.textContent.trim();
      break;
    }
  }

  if (icao) {
    console.log(`Found ICAO: ${icao}`);
    if (registration) console.log(`Found Registration: ${registration}`);
    if (callsign) console.log(`Found Callsign: ${callsign}`);

    analyzeIcaoMismatch(icao, registration, callsign);
  } else {
    console.log("❌ Could not extract ICAO from page");
    console.log('💡 Try: analyzeIcaoMismatch("464A91", "OH-LWA", "OHU609")');
  }
}

if (window.location.hostname.includes("adsbexchange.com")) {
  console.log("🛩️ ADS-B Exchange detected - auto-analyzing...");
  setTimeout(analyzePlaneFromPage, 1000);
}

console.log(
  "%c🛩️ ICAO Mismatch Detector Loaded!",
  "font-size: 14px; color: #2196F3; font-weight: bold;",
);
console.log("Usage:");
console.log("  analyzePlaneFromPage() - Auto-extract from current page");
console.log(
  '  analyzeIcaoMismatch("464A91", "OH-LWA", "OHU609") - Manual analysis',
);

module.exports = { analyzeIcaoMismatch, analyzePlaneFromPage };
