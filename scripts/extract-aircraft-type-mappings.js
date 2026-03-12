/**
 * Extract all ICAO type codes and their corresponding model names
 * from basic-ac-db files to generate a comprehensive type mapping
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

async function extractTypeMappings() {
  const inputFiles = [
    "../src/assets/basic-ac-db1.json",
    "../src/assets/basic-ac-db2.json",
  ];

  const typeMap = new Map(); // icaotype -> Set of model names
  let totalProcessed = 0;

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

        const icaoType = aircraft.icaotype?.trim().toUpperCase();
        const model = aircraft.model?.trim();

        if (icaoType && model) {
          if (!typeMap.has(icaoType)) {
            typeMap.set(icaoType, new Set());
          }
          typeMap.get(icaoType).add(model);
        }

        if (totalProcessed % 100000 === 0) {
          console.log(`  Processed ${totalProcessed} aircraft...`);
        }
      } catch (error) {
        console.error(`Error parsing line: ${error.message}`);
      }
    }
  }

  console.log(`\nTotal aircraft processed: ${totalProcessed}`);
  console.log(`Unique ICAO type codes found: ${typeMap.size}`);

  // Convert to a clean mapping (icaoType -> best model name)
  const cleanMap = {};
  for (const [icaoType, modelSet] of typeMap.entries()) {
    const models = Array.from(modelSet);

    // Score each model name and pick the best one
    let bestModel = models[0];
    let bestScore = scoreModelName(bestModel);

    for (const model of models) {
      const score = scoreModelName(model);
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    cleanMap[icaoType] = bestModel;
  }

  // Sort by ICAO code for readability
  const sortedEntries = Object.entries(cleanMap).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const sortedMap = Object.fromEntries(sortedEntries);

  // Write to output file
  const outputPath = path.join(__dirname, "output/aircraft-type-mappings.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(sortedMap, null, 2));

  console.log(`\nOutput written to: ${outputPath}`);
  console.log(`Total mappings: ${Object.keys(sortedMap).length}`);

  // Show some statistics
  console.log(`\nSample mappings:`);
  const sample = sortedEntries.slice(0, 20);
  for (const [code, name] of sample) {
    console.log(`  ${code.padEnd(8)} => ${name}`);
  }

  // Generate TypeScript code
  const tsCode = generateTypeScriptCode(sortedEntries);
  const tsOutputPath = path.join(
    __dirname,
    "output/aircraft-type-names-generated.ts",
  );
  fs.writeFileSync(tsOutputPath, tsCode);
  console.log(`\nTypeScript code written to: ${tsOutputPath}`);
}

function generateTypeScriptCode(entries) {
  const lines = [
    "/**",
    " * ICAO aircraft type code to readable model name mapping",
    " * Auto-generated from basic-ac-db files",
    " * DO NOT EDIT MANUALLY - regenerate with extract-aircraft-type-mappings.js",
    " */",
    "",
    "export interface AircraftTypeName {",
    "  code: string;",
    "  name: string;",
    "}",
    "",
    "export const AIRCRAFT_TYPE_NAMES: readonly AircraftTypeName[] = [",
  ];

  for (const [code, name] of entries) {
    // Escape quotes in name
    const escapedName = name.replace(/'/g, "\\'");
    lines.push(`  { code: '${code}', name: '${escapedName}' },`);
  }

  lines.push(
    "] as const;",
    "",
    "/**",
    " * Map for fast ICAO code to name lookup",
    " */",
    "const AIRCRAFT_TYPE_MAP = new Map<string, string>(",
    "  AIRCRAFT_TYPE_NAMES.map((type) => [type.code.toUpperCase(), type.name])",
    ");",
    "",
    "/**",
    " * Convert ICAO aircraft type code to readable model name",
    " * @param icaoCode ICAO aircraft type designator (e.g., 'B738', 'A320')",
    " * @returns Readable aircraft model name or the original code if not found",
    " */",
    "export function getAircraftTypeName(icaoCode: string): string {",
    "  if (!icaoCode) return '';",
    "  const upperCode = icaoCode.trim().toUpperCase();",
    "  return AIRCRAFT_TYPE_MAP.get(upperCode) || icaoCode;",
    "}",
    "",
  );

  return lines.join("\n");
}

extractTypeMappings().catch(console.error);

/**
 * Score a model name to determine how good it is as a representative name
 * Higher score = better
 */
function scoreModelName(name) {
  let score = 0;
  const nameLower = name.toLowerCase();

  // Strongly prefer names with manufacturer keywords
  if (/airbus/i.test(name)) score += 100;
  if (/boeing/i.test(name)) score += 100;
  if (/embraer/i.test(name)) score += 80;
  if (/bombardier/i.test(name)) score += 80;
  if (/cessna/i.test(name)) score += 70;
  if (/beechcraft|beech/i.test(name)) score += 70;
  if (/gulfstream/i.test(name)) score += 70;
  if (/lockheed/i.test(name)) score += 70;
  if (/havilland/i.test(name)) score += 70;
  if (/dassault/i.test(name)) score += 70;
  if (/cirrus/i.test(name)) score += 60;
  if (/pilatus/i.test(name)) score += 60;
  if (/antonov/i.test(name)) score += 60;
  if (/bell\s[\d]/i.test(name)) score += 60;
  if (/sikorsky/i.test(name)) score += 60;
  if (/piper/i.test(name)) score += 50;

  // Penalize very short names (likely tail numbers)
  if (name.length < 5) score -= 50;

  // Penalize names with too many dashes (likely specific variants)
  const dashCount = (name.match(/-/g) || []).length;
  if (dashCount > 2) score -= 20;

  // Prefer names that look like model numbers without too much specificity
  if (/\d{3,4}[a-z]?$/i.test(name.trim())) score += 10; // Like "737-800" or "A320"

  // Penalize names with registration patterns
  if (/[A-Z]{1,2}-[A-Z]{3,4}/i.test(name)) score -= 30; // Like "N-123AB"
  if (/\d{3}[A-Z]{2,3}$/i.test(name)) score -= 30; // Like "737ABC"

  // Prefer reasonable length names
  if (name.length >= 10 && name.length <= 30) score += 15;
  if (name.length > 50) score -= 20;

  // Prefer names without too many numbers at the end
  if (/\d{4,}$/.test(name)) score -= 25; // Like ending in "2019"

  return score;
}
