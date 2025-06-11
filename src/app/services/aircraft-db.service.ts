import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AircraftRecord {
  icao: string;
  reg: string;
  icaotype: string;
  year: string;
  manufacturer: string;
  model: string;
  ownop: string;
  faa_pia: boolean;
  faa_ladd: boolean;
  short_type: string;
  mil: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AircraftDbService {
  private db: Map<string, AircraftRecord> = new Map();

  constructor(private http: HttpClient) {}

  load(): Promise<void> {
    // Load split database files and merge
    return Promise.all([
      this.http
        .get('/assets/basic-ac-db1.json', { responseType: 'text' })
        .toPromise(),
      this.http
        .get('/assets/basic-ac-db2.json', { responseType: 'text' })
        .toPromise(),
    ])
      .then((texts) => {
        const records: AircraftRecord[] = [];
        texts.forEach((text, idx) => {
          if (!text) {
            // Empty response from basic-ac-db file
            return;
          }
          text
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .forEach((line) => {
              try {
                records.push(JSON.parse(line));
              } catch (e) {
                // Error parsing line
              }
            });
        });
        records.forEach((rec) => this.db.set(rec.icao.toLowerCase(), rec));
      })
      .catch((error) => {
        // Error loading aircraft DB fragments
        throw error;
      });
  }

  lookup(icaoHex: string): AircraftRecord | undefined {
    return this.db.get(icaoHex.toLowerCase());
  }
}
