const https = require("https");
const fs = require("fs");
const path = require("path");

// All Wikipedia airline code pages to scrape
const pages = [
  "List_of_airline_codes_(0–9)",
  "List_of_airline_codes_(A)",
  "List_of_airline_codes_(B)",
  "List_of_airline_codes_(C)",
  "List_of_airline_codes_(D)",
  "List_of_airline_codes_(E)",
  "List_of_airline_codes_(F)",
  "List_of_airline_codes_(G)",
  "List_of_airline_codes_(H)",
  "List_of_airline_codes_(I)",
  "List_of_airline_codes_(J)",
  "List_of_airline_codes_(K)",
  "List_of_airline_codes_(L)",
  "List_of_airline_codes_(M)",
  "List_of_airline_codes_(N)",
  "List_of_airline_codes_(O)",
  "List_of_airline_codes_(P)",
  "List_of_airline_codes_(Q)",
  "List_of_airline_codes_(R)",
  "List_of_airline_codes_(S)",
  "List_of_airline_codes_(T)",
  "List_of_airline_codes_(U)",
  "List_of_airline_codes_(V)",
  "List_of_airline_codes_(W)",
  "List_of_airline_codes_(X)",
  "List_of_airline_codes_(Y)",
  "List_of_airline_codes_(Z)",
];

const airlines = {};

function fetchPage(pageName) {
  return new Promise((resolve, reject) => {
    // Use Wikipedia's API to get clean HTML
    const url = `https://en.wikipedia.org/api/rest_v1/page/html/${pageName}`;
    const options = {
      headers: {
        "User-Agent":
          "PlaneAlert/1.0 (Educational aircraft tracking app; contact@example.com)",
      },
    };

    https
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function extractAirlines(html) {
  // Wikipedia uses HTML tables with <tr> and <td> tags
  // Look for table rows with airline data

  let found = 0;

  // Match table rows
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract all table cells
    const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
    const cells = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Clean HTML tags and entities
      let content = cellMatch[1]
        .replace(/<[^>]+>/g, "") // Remove HTML tags
        .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
        .replace(/&amp;/g, "&") // Replace &amp; with &
        .trim();
      cells.push(content);
    }

    // Need at least 3 cells: IATA, ICAO, Name
    if (cells.length < 3) {
      continue;
    }

    const iataCode = cells[0];
    const icaoCode = cells[1];
    let airlineName = cells[2];

    // Validate ICAO code (3 characters, letters only)
    const cleanIcao = icaoCode.replace(/\*/g, "").trim();
    if (!cleanIcao || cleanIcao.length !== 3 || !/^[A-Z]{3}$/.test(cleanIcao)) {
      continue;
    }

    // Clean up airline name
    airlineName = airlineName
      .replace(/\[.*?\]/g, "") // Remove [citations]
      .replace(/\(.*?\)/g, "") // Remove (parentheses)
      .replace(/\*$/g, "") // Remove trailing asterisk
      .trim();

    // Skip empty or very short names
    if (!airlineName || airlineName.length < 3) {
      continue;
    }

    // Store the airline with ICAO code
    airlines[cleanIcao] = airlineName;
    found++;
  }

  return found;
}

async function scrapeAllPages() {
  console.log("Scraping Wikipedia airline codes...");

  for (const page of pages) {
    console.log(`\nFetching ${page}...`);
    try {
      const html = await fetchPage(page);
      const found = extractAirlines(html);
      console.log(`  Extracted ${found} airlines`);

      // Be nice to Wikipedia - wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching ${page}:`, error.message);
    }
  }

  console.log(
    `\nScraped ${Object.keys(airlines).length} total airlines from Wikipedia`
  );

  // Load existing operator-call-signs.json
  const callSignsPath = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "operator-call-signs.json"
  );
  let existingData = {};

  if (fs.existsSync(callSignsPath)) {
    existingData = JSON.parse(fs.readFileSync(callSignsPath, "utf8"));
    console.log(`Loaded ${Object.keys(existingData).length} existing airlines`);
  }

  // Merge Wikipedia data with existing data (Wikipedia takes precedence for new entries)
  const merged = { ...airlines, ...existingData };
  console.log(`Merged total: ${Object.keys(merged).length} airlines`);

  // Save to file
  fs.writeFileSync(callSignsPath, JSON.stringify(merged, null, 2));
  console.log(`\nSaved to ${callSignsPath}`);
}

scrapeAllPages().catch(console.error);
