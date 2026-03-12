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
  private userDb: Map<string, AircraftRecord> = new Map();
  private readonly USER_DB_KEY = 'plane-alert-user-aircraft-db';
  private isLoading = false;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  // Global reference for development access
  public currentUserDbJson = '';
  // Debounce file writes
  private saveTimeout: any = null;
  private localStorageSaveTimeout: any = null;
  private lastFileWrite = 0;
  private readonly MIN_WRITE_INTERVAL = 60000; // Write max once per 60 seconds
  private readonly LOCAL_SAVE_DEBOUNCE_MS = 1000;

  constructor(private http: HttpClient) {
    // Make service globally accessible for console access
    if (typeof window !== 'undefined') {
      (window as any).aircraftDbService = this;
    }
    // Load user DB immediately (much smaller), defer main DB
    this.loadUserDataOnly();
  }

  /**
   * Lazy load full database - only for admin/debugging
   * Normal operation no longer needs this
   */
  async loadFullDatabase(): Promise<void> {
    if (this.isLoaded) {
      console.log('✅ Database already loaded');
      return;
    }
    console.log('⚠️ Loading full 607k aircraft database (for admin use only)...');
    await this.load();
  }

  /**
   * Lazy load the full aircraft database
   * Returns immediately if already loaded or loading
   */
  private load(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.isLoading = true;
    console.log('📦 Loading aircraft database (this may take a moment)...');
    
    // Load split database files and merge
    this.loadPromise = Promise.all([
      this.http
        .get('/assets/basic-ac-db1.json', { responseType: 'text' })
        .toPromise(),
      this.http
        .get('/assets/basic-ac-db2.json', { responseType: 'text' })
        .toPromise(),
      this.http
        .get('/assets/user-aircraft-db.json', { responseType: 'text' })
        .toPromise()
        .catch(() => ''), // User DB is optional, don't fail if missing
    ])
      .then((texts) => {
        const records: AircraftRecord[] = [];
        texts.forEach((text, idx) => {
          if (!text) {
            // Empty response from database file
            return;
          }
          if (idx === 2) {
            // Handle user-aircraft-db.json (JSON array format)
            try {
              const jsonData = JSON.parse(text);
              if (Array.isArray(jsonData)) {
                // Skip the header record if it exists
                jsonData.forEach((record) => {
                  if (record.note || record.version) return;
                  records.push(record);
                });
              }
            } catch (e) {
              console.warn('Error parsing user-aircraft-db.json:', e);
            }
          } else {
            // Handle basic-ac-db files (JSON Lines format)
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
          }
        });
        records.forEach((rec) => this.db.set(rec.icao.toLowerCase(), rec));
        console.log(`✅ Loaded ${this.db.size} aircraft from main database`);
        this.loadUserData();
        this.isLoaded = true;
        this.isLoading = false;
      })
      .catch((error) => {
        console.error('❌ Failed to load aircraft database:', error);
        this.isLoading = false;
        this.loadPromise = null;
        throw error;
      });
    
    return this.loadPromise;
  }

  /**
   * Load only user database from localStorage (fast, small dataset)
   */
  private loadUserDataOnly(): void {
    const stored = localStorage.getItem(this.USER_DB_KEY);
    if (stored) {
      try {
        const records: AircraftRecord[] = JSON.parse(stored);
        records.forEach((rec) => {
          const icao = rec.icao.toLowerCase();
          this.userDb.set(icao, rec);
        });
        console.log(`✅ Loaded ${this.userDb.size} user aircraft from localStorage (main 607k DB NOT loaded - using API data instead)`);
      } catch (e) {
        console.error('Error loading user aircraft data:', e);
      }
    } else {
      console.log('📊 No user aircraft database found (main 607k DB NOT loaded - using API data instead)');
    }
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
    if (this.localStorageSaveTimeout) {
      clearTimeout(this.localStorageSaveTimeout);
      this.localStorageSaveTimeout = null;
    }

    this.localStorageSaveTimeout = setTimeout(() => {
      const records = Array.from(this.userDb.values());
      localStorage.setItem(this.USER_DB_KEY, JSON.stringify(records));

      // Make current database available globally for easy access
      if (typeof window !== 'undefined') {
        (window as any).planeAlertUserDb = this.exportUserRecordsAsJsonArray();
      }

      // Debounce file writes to prevent constant refreshes
      this.debouncedSaveToFile();
    }, this.LOCAL_SAVE_DEBOUNCE_MS);
  }

  private updateGlobalJson(): void {
    this.currentUserDbJson = this.exportUserRecordsAsJsonArray();
  }

  /**
   * Look up aircraft by ICAO hex
   * Only checks user database (no lazy loading of 607k main DB)
   */
  lookup(icaoHex: string): AircraftRecord | undefined {
    const lower = icaoHex.toLowerCase();
    
    // Only check user database - no longer load the massive main database
    return this.userDb.get(lower);
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

  /** Save database to file in the repository */
  private saveToFile(): void {
    if (typeof window === 'undefined' || this.userDb.size === 0) {
      return;
    }

    const hostname = window.location.hostname;
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0';

    if (!isLocalHost) {
      console.log(
        'Skipping /save-db call because app is not running on the local dev server.'
      );
      return;
    }

    const content = this.exportUserRecordsAsJsonArray();

    // Write directly to the repository file
    fetch('/save-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content,
        count: this.userDb.size,
      }),
    })
      .then((response) => {
        if (response.ok) {
          console.log(
            `✅ Saved ${this.userDb.size} user aircraft to repository`
          );
        } else {
          console.warn('Failed to save user database to repository');
        }
      })
      .catch((error) => {
        console.warn('Could not save to repository:', error.message);
        console.log('User data is still saved in localStorage');
      });
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
