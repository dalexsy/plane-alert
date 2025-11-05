/**
 * Extract military aircraft from basic-ac-db files
 * This creates a smaller database with only military aircraft
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

async function extractMilitaryAircraft() {
  const inputFiles = [
    "../../src/assets/basic-ac-db1.json",
    "../../src/assets/basic-ac-db2.json",
  ];

  const militaryDb = {};
  let totalProcessed = 0;
  let militaryCount = 0;

  for (const inputFile of inputFiles) {
    const filePath = path.join(__dirname, inputFile);
    console.log(`Processing ${inputFile}...`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Process line by line (JSONL format)
    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const aircraft = JSON.parse(line);
        totalProcessed++;

        if (aircraft.mil === true) {
          // Use ICAO as key
          militaryDb[aircraft.icao.toLowerCase()] = {
            reg: aircraft.reg,
            type: aircraft.short_type || aircraft.icaotype,
            manufacturer: aircraft.manufacturer,
            model: aircraft.model,
            ownop: aircraft.ownop,
            mil: true,
          };
          militaryCount++;
        }
      } catch (error) {
        console.error(`Error parsing line: ${error.message}`);
      }
    }

    console.log(
      `  Processed: ${totalProcessed}, Military found: ${militaryCount}`
    );
  }

  // Write the military-only database
  const outputPath = path.join(
    __dirname,
    "../src/data/military-aircraft-db.json"
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(militaryDb, null, 2));

  const outputSize = fs.statSync(outputPath).size;
  console.log(`\nExtraction complete!`);
  console.log(`Total aircraft processed: ${totalProcessed}`);
  console.log(`Military aircraft found: ${militaryCount}`);
  console.log(`Output file: ${outputPath}`);
  console.log(`Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);

  // Show sample entries
  const sample = Object.entries(militaryDb).slice(0, 3);
  console.log(`\nSample entries:`);
  console.log(JSON.stringify(sample, null, 2));
}

extractMilitaryAircraft().catch(console.error);
