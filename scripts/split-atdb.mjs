import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'parse-atdb-data.js'), 'utf8');
const lines = src.split(/\r?\n/);

const allocStart = lines.findIndex((l) => l.includes('const ATDB_ALLOCATIONS'));
const isoStart = lines.findIndex((l) => l.includes('const COUNTRY_TO_ISO2'));
const isoEnd = lines.findIndex((l, i) => i > isoStart && l.trim() === '};');

const libDir = path.join(__dirname, 'lib');
fs.mkdirSync(libDir, { recursive: true });

const allocLines = lines.slice(allocStart, isoStart);
const isoLines = lines.slice(isoStart, isoEnd + 1);

fs.writeFileSync(
  path.join(libDir, 'atdb-allocations-data.js'),
  allocLines.join('\n').replace('const ATDB_ALLOCATIONS', 'const ATDB_ALLOCATIONS') +
    '\nmodule.exports = { ATDB_ALLOCATIONS };\n'
);

fs.writeFileSync(
  path.join(libDir, 'atdb-country-iso2.js'),
  isoLines.join('\n').replace('const COUNTRY_TO_ISO2', 'const COUNTRY_TO_ISO2') +
    '\nmodule.exports = { COUNTRY_TO_ISO2 };\n'
);

const utilsPath = path.join(libDir, 'atdb-parse-utils.js');
fs.writeFileSync(
  utilsPath,
  `const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { ATDB_ALLOCATIONS } = require('./atdb-allocations-data');
const { COUNTRY_TO_ISO2 } = require('./atdb-country-iso2');

function parseATDBData() {
  console.log('Parsing ATDB ICAO allocation data...');
  const ranges = [];
  let processedCount = 0;
  let skippedCount = 0;
  for (const allocation of ATDB_ALLOCATIONS) {
    if (
      allocation.country.includes('(') ||
      allocation.country.includes('reserved') ||
      allocation.country.includes('unallocated') ||
      allocation.country.includes('ICAO')
    ) {
      skippedCount++;
      continue;
    }
    const iso2 = COUNTRY_TO_ISO2[allocation.country];
    if (!iso2) {
      console.warn('Unknown country: ' + allocation.country);
      skippedCount++;
      continue;
    }
    const startDec = parseInt(allocation.from, 16);
    const finishDec = parseInt(allocation.to, 16);
    ranges.push({
      startHex: allocation.from,
      finishHex: allocation.to,
      startDec,
      finishDec,
      isMilitary: false,
      countryISO2: iso2,
      significantBitmask: 'FFFFFF',
    });
    processedCount++;
  }
  console.log('Processed ' + processedCount + ' ranges');
  console.log('Skipped ' + skippedCount + ' reserved/unallocated ranges');
  return ranges;
}

function testSpecificCases(ranges) {
  console.log('Testing specific problem cases...');
  const testCases = [
    { icao: '464A91', callsign: 'OHU609', expected: 'FI' },
    { icao: '480C1B', callsign: 'NAF15', expected: 'NL' },
  ];
  for (const test of testCases) {
    const decimal = parseInt(test.icao, 16);
    const range = ranges.find((r) => decimal >= r.startDec && decimal <= r.finishDec);
    if (range) {
      const correct = range.countryISO2 === test.expected;
      console.log((correct ? 'OK' : 'FAIL') + ' ' + test.icao);
    } else {
      console.log('NO RANGE ' + test.icao);
    }
  }
}

function saveRanges(ranges) {
  const outputPath = path.join(__dirname, '..', 'src', 'assets', 'data', 'icao-country-ranges-atdb.json');
  ranges.sort((a, b) => a.startDec - b.startDec);
  fs.writeFileSync(outputPath, JSON.stringify(ranges, null, 2), 'utf8');
  console.log('Saved ' + ranges.length + ' ranges to: ' + outputPath);
}

function updateIcaoRangesFromAtdb(atdbHtmlPath, outputJsonPath) {
  const html = fs.readFileSync(atdbHtmlPath, 'utf8');
  const $ = cheerio.load(html);
  const ranges = [];
  $('table tr').each((i, row) => {
    const cols = $(row).find('td');
    if (cols.length >= 3) {
      const countryISO2 = $(cols[0]).text().trim();
      const startHex = $(cols[1]).text().trim();
      const finishHex = $(cols[2]).text().trim();
      ranges.push({
        startHex,
        finishHex,
        startDec: parseInt(startHex, 16),
        finishDec: parseInt(finishHex, 16),
        isMilitary: false,
        countryISO2,
        significantBitmask: 'FFFFFF00',
      });
    }
  });
  fs.writeFileSync(outputJsonPath, JSON.stringify(ranges, null, 2), 'utf8');
  console.log('Updated ICAO ranges JSON with ' + ranges.length + ' entries');
}

module.exports = { parseATDBData, testSpecificCases, saveRanges, updateIcaoRangesFromAtdb };
`
);

const main = `const path = require('path');
const { parseATDBData, testSpecificCases, saveRanges, updateIcaoRangesFromAtdb } = require('./lib/atdb-parse-utils');

const atdbHtmlPath =
  'C:\\\\Users\\\\dalex\\\\Downloads\\\\ATDB - ICAO 24-bit addresses - Decode.html';
const outputJsonPath = path.resolve(__dirname, '../src/assets/data/icao-country-ranges.json');

updateIcaoRangesFromAtdb(atdbHtmlPath, outputJsonPath);

const ranges = parseATDBData();
testSpecificCases(ranges);
saveRanges(ranges);

console.log('ATDB data parsed and converted to proper format');
`;

fs.writeFileSync(path.join(__dirname, 'parse-atdb-data.js'), main);
console.log('Split complete');
