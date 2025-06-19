/**
 * Browser Console Helper for ICAO Mismatch Detection
 *
 * Paste this code into your browser console when viewing aircraft data
 * to quickly analyze ICAO/country mismatches.
 *
 * Usage in browser console:
 * 1. Copy and paste this entire code block into console
 * 2. Call: analyzePlaneFromPage() - to auto-extract from current page
 * 3. Or call: analyzeIcaoMismatch('464A91', 'OH-LWA', 'OHU609')
 */

// ICAO Country Ranges (subset for browser use - add more as needed)
const ICAO_RANGES = [
  { start: 0x440000, end: 0x47ffff, country: "IT", range: "440000-47FFFF" },
  { start: 0x505c00, end: 0x505fff, country: "FI", range: "505C00-505FFF" },
  { start: 0x4b0000, end: 0x4b7fff, country: "CH", range: "4B0000-4B7FFF" },
  { start: 0x400000, end: 0x43ffff, country: "GB", range: "400000-43FFFF" },
  { start: 0x380000, end: 0x3fffff, country: "FR", range: "380000-3FFFFF" },
  { start: 0x3c0000, end: 0x3fffff, country: "DE", range: "3C0000-3FFFFF" },
  // Add more ranges as needed
];

// Registration prefixes (subset)
const REG_PREFIXES = {
  OH: "FI",
  HB: "CH",
  G: "GB",
  F: "FR",
  D: "DE",
  N: "US",
  VH: "AU",
  JA: "JP",
  HL: "KR",
  B: "CN",
  RA: "RU",
  // Add more as needed
};

function findIcaoCountry(icaoHex) {
  const decimal = parseInt(icaoHex, 16);
  const range = ICAO_RANGES.find((r) => decimal >= r.start && decimal <= r.end);
  return range ? { ...range, decimal } : null;
}

function findRegistrationCountry(registration) {
  if (!registration) return null;

  const reg = registration.trim().toUpperCase();
  const sortedPrefixes = Object.keys(REG_PREFIXES).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return { country: REG_PREFIXES[prefix], prefix };
    }
  }
  return null;
}

function analyzeIcaoMismatch(icaoHex, registration, callsign) {
  console.log(
    "%c🛩️ ICAO MISMATCH ANALYSIS",
    "font-size: 16px; font-weight: bold; color: #2196F3;"
  );
  console.log("━".repeat(50));
  console.log(
    `ICAO: ${icaoHex} | Registration: ${registration || "N/A"} | Callsign: ${
      callsign || "N/A"
    }`
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

  // Check for mismatch
  if (icaoResult && regResult && icaoResult.country !== regResult.country) {
    console.log(
      "\n%c⚠️ MISMATCH DETECTED!",
      "color: #FF9800; font-weight: bold;"
    );
    console.log(`   ICAO suggests: ${icaoResult.country}`);
    console.log(`   Registration suggests: ${regResult.country}`);
    console.log("\n💡 Actions:");
    console.log(`   1. Report this mismatch`);
    console.log(`   2. Check if ICAO range needs updating`);
    console.log(`   3. Consider special cases (military, lease, etc.)`);

    // Generate report data
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

    // Try to copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(JSON.stringify(reportData, null, 2))
        .then(() => console.log("✅ Report data copied to clipboard!"))
        .catch(() => console.log("❌ Could not copy to clipboard"));
    }
  } else if (icaoResult && regResult) {
    console.log(
      "\n%c✅ No mismatch detected",
      "color: #4CAF50; font-weight: bold;"
    );
  } else {
    console.log("\n%c❓ Insufficient data for comparison", "color: #9E9E9E;");
  }

  console.log("━".repeat(50));
}

function analyzePlaneFromPage() {
  console.log("🔍 Attempting to extract aircraft data from page...");

  // Try to extract ICAO from URL (ADS-B Exchange)
  let icao = null;
  const urlMatch = window.location.href.match(/icao=([A-Fa-f0-9]+)/i);
  if (urlMatch) {
    icao = urlMatch[1].toUpperCase();
  }

  // Try to extract from page elements
  let registration = null;
  let callsign = null;

  // Look for common selectors
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

  // If we found ICAO, analyze it
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

// Auto-analyze if this script detects it's on ADS-B Exchange
if (window.location.hostname.includes("adsbexchange.com")) {
  console.log("🛩️ ADS-B Exchange detected - auto-analyzing...");
  setTimeout(analyzePlaneFromPage, 1000);
}

console.log(
  "%c🛩️ ICAO Mismatch Detector Loaded!",
  "font-size: 14px; color: #2196F3; font-weight: bold;"
);
console.log("Usage:");
console.log("  analyzePlaneFromPage() - Auto-extract from current page");
console.log(
  '  analyzeIcaoMismatch("464A91", "OH-LWA", "OHU609") - Manual analysis'
);
