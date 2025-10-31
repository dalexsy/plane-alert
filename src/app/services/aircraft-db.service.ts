import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_BASE_HREF } from '@angular/common';

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
  private userDb: Map<string, AircraftRecord> = new Map();
  private readonly USER_DB_KEY = 'plane-alert-user-aircraft-db';
  // Global reference for development access
  public currentUserDbJson = '';
  // Debounce file writes
  private saveTimeout: any = null;
  private lastFileWrite = 0;
  private readonly MIN_WRITE_INTERVAL = 60000; // Write max once per 60 seconds

  constructor(private http: HttpClient, @Inject(APP_BASE_HREF) private baseHref: string) {
    // Make service globally accessible for console access
    if (typeof window !== 'undefined') {
      (window as any).aircraftDbService = this;
    }
  }

  load(): Promise<void> {
    // Load split database files and merge
    return Promise.all([
      this.http
        .get(`${this.baseHref}assets/basic-ac-db1.json`, { responseType: 'text' })
        .toPromise(),
      this.http
        .get(`${this.baseHref}assets/basic-ac-db2.json`, { responseType: 'text' })
        .toPromise(),
    ])
      .then((texts) => {
        const records: AircraftRecord[] = [];
        texts.forEach((text, idx) => {
          if (!text) {
            // Empty response from database file
            return;
          }
          text
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .forEach((line) => {
              try {
                const record = JSON.parse(line);
                // Skip metadata records
                if (record.note || record.version) return;
                records.push(record);
              } catch (e) {
                // Error parsing line
              }
            });
        });
        records.forEach((rec) => this.db.set(rec.icao.toLowerCase(), rec));
        console.log(`✅ Loaded ${this.db.size} aircraft from main database`);
        this.loadUserData();
      })
      .catch((error) => {
        // Error loading aircraft DB fragments
        throw error;
      });
  }

  private loadUserData(): void {
    const stored = localStorage.getItem(this.USER_DB_KEY);
    if (stored) {
      try {
        const records: AircraftRecord[] = JSON.parse(stored);
        // Only load records that are NOT in the main database
        records.forEach((rec) => {
          const icao = rec.icao.toLowerCase();
          if (!this.db.has(icao)) {
            this.userDb.set(icao, rec);
          }
        });
        console.log(
          `Loaded ${
            this.userDb.size
          } user aircraft from localStorage (filtered out ${
            records.length - this.userDb.size
          } duplicates)`
        );
      } catch (e) {
        console.error('Error loading user aircraft data:', e);
      }
    }
  }

  private saveUserData(): void {
    const records = Array.from(this.userDb.values());
    localStorage.setItem(this.USER_DB_KEY, JSON.stringify(records));

    // Make current database available globally for easy access
    if (typeof window !== 'undefined') {
      (window as any).planeAlertUserDb = this.exportUserRecordsAsJsonArray();
    }

    // Debounce file writes to prevent constant refreshes
    this.debouncedSaveToFile();
  }

  private updateGlobalJson(): void {
    this.currentUserDbJson = this.exportUserRecordsAsJsonArray();
  }

  lookup(icaoHex: string): AircraftRecord | undefined {
    const lower = icaoHex.toLowerCase();
    // Check main database first - it has accurate data
    // Only fall back to user database if not found in main DB
    return this.db.get(lower) || this.userDb.get(lower);
  }

  addRecord(record: AircraftRecord): void {
    const icao = record.icao.toLowerCase();

    // Only add to database if not already in the main database or user database
    if (!this.db.has(icao) && !this.userDb.has(icao)) {
      this.userDb.set(icao, record);
      this.saveUserData();
      this.updateGlobalJson();

      console.log(
        `✅ Added aircraft ${record.icao} to database (${this.userDb.size} total unknown aircraft)`
      );
    }
  }

  removeRecord(icao: string): void {
    this.userDb.delete(icao.toLowerCase());
    this.saveUserData();
    this.updateGlobalJson();
  }

  getUserRecords(): AircraftRecord[] {
    return Array.from(this.userDb.values());
  }

  importRecords(records: AircraftRecord[]): void {
    records.forEach((rec) => this.userDb.set(rec.icao.toLowerCase(), rec));
    this.saveUserData();
    this.updateGlobalJson();
  }

  /** Export user records in JSON array format for src/assets/user-aircraft-db.json */
  exportUserRecordsAsJsonArray(): string {
    const records = Array.from(this.userDb.values());
    const header = {
      note: 'User-added aircraft database - automatically populated',
      version: '1.0',
      exported: new Date().toISOString(),
    };
    const allRecords = [header, ...records];
    return JSON.stringify(allRecords, null, 2);
  }

  /** Get statistics about the database */
  getDatabaseStats(): { mainDb: number; userDb: number; total: number } {
    return {
      mainDb: this.db.size,
      userDb: this.userDb.size,
      total: this.db.size + this.userDb.size,
    };
  }

  /** Console method to get current user database for manual file updates */
  getCurrentUserDbForFile(): string {
    console.log('📋 Copy this content to src/assets/user-aircraft-db.json:');
    const content = this.exportUserRecordsAsJsonArray();
    console.log(content);
    return content;
  }

  /** Automatically download the updated database file */
  private downloadUpdatedDatabase(): void {
    if (typeof window !== 'undefined' && this.userDb.size > 0) {
      const content = this.exportUserRecordsAsJsonArray();
      const blob = new Blob([content], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'user-aircraft-db.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('📥 Automatically downloaded updated user-aircraft-db.json');
    }
  }

  /** Manually download the current database file */
  downloadDatabaseFile(): void {
    this.downloadUpdatedDatabase();
  }

  /** Save database to file via local server (development only) */
  private saveToFile(): void {
    if (typeof window === 'undefined' || this.userDb.size === 0) {
      return;
    }

    const content = this.exportUserRecordsAsJsonArray();

    // Only attempt to save in development (when running on localhost)
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      fetch('http://localhost:3001/save-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          count: this.userDb.size,
        }),
      }).catch((error) => {
        // Silently fail if server is not running - this is optional functionality
        console.debug('File server not available:', error.message);
      });
    }
  }

  /** Debounced version of saveToFile to prevent constant refreshes */
  private debouncedSaveToFile(): void {
    const now = Date.now();

    // Clear any pending timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // If enough time has passed since last write, write immediately
    if (now - this.lastFileWrite >= this.MIN_WRITE_INTERVAL) {
      this.lastFileWrite = now;
      this.saveToFile();
    } else {
      // Otherwise, schedule a write for later
      this.saveTimeout = setTimeout(() => {
        this.lastFileWrite = Date.now();
        this.saveToFile();
      }, this.MIN_WRITE_INTERVAL - (now - this.lastFileWrite));
    }
  }
}
