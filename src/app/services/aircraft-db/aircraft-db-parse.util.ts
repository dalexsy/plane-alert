import type { AircraftRecord } from './aircraft-db-types';

export function parseDbTextFragments(texts: (string | undefined)[]): AircraftRecord[] {
  const records: AircraftRecord[] = [];
  texts.forEach((text, idx) => {
    if (!text) return;
    if (idx === 2) {
      try {
        const jsonData = JSON.parse(text);
        if (Array.isArray(jsonData)) {
          jsonData.forEach((record) => {
            if (record.note || record.version) return;
            records.push(record);
          });
        }
      } catch (e) {
        console.warn('Error parsing user-aircraft-db.json:', e);
      }
    } else {
      text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .forEach((line) => {
          try {
            const record = JSON.parse(line);
            if (record.note || record.version) return;
            records.push(record);
          } catch {
            /* skip bad line */
          }
        });
    }
  });
  return records;
}

export function exportUserRecordsJson(records: AircraftRecord[]): string {
  const header = {
    note: 'User-added aircraft database - automatically populated',
    version: '1.0',
    exported: new Date().toISOString(),
  };
  return JSON.stringify([header, ...records], null, 2);
}
