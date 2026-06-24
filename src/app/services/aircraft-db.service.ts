import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AircraftRecord,
  USER_DB_KEY,
} from './aircraft-db/aircraft-db-types';
import {
  exportUserRecordsJson,
  parseDbTextFragments,
} from './aircraft-db/aircraft-db-parse.util';
import {
  DebounceState,
  downloadJsonFile,
  isLocalDevHost,
  postSaveDb,
  scheduleDebouncedSave,
} from './aircraft-db/aircraft-db-persist.util';

export type { AircraftRecord } from './aircraft-db/aircraft-db-types';

@Injectable({ providedIn: 'root' })
export class AircraftDbService {
  private db = new Map<string, AircraftRecord>();
  private userDb = new Map<string, AircraftRecord>();
  public currentUserDbJson = '';
  private debounce: DebounceState = { saveTimeout: null, lastFileWrite: 0 };

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      (window as any).aircraftDbService = this;
    }
  }

  load(): Promise<void> {
    return Promise.all([
      this.http.get('/assets/basic-ac-db1.json', { responseType: 'text' }).toPromise(),
      this.http.get('/assets/basic-ac-db2.json', { responseType: 'text' }).toPromise(),
      this.http.get('/assets/user-aircraft-db.json', { responseType: 'text' }).toPromise().catch(() => ''),
    ])
      .then((texts) => {
        parseDbTextFragments(texts).forEach((rec) => this.db.set(rec.icao.toLowerCase(), rec));
        console.log(`✅ Loaded ${this.db.size} aircraft from main database`);
        this.loadUserData();
      })
      .catch((error) => {
        throw error;
      });
  }

  private loadUserData(): void {
    const stored = localStorage.getItem(USER_DB_KEY);
    if (!stored) return;
    try {
      const records: AircraftRecord[] = JSON.parse(stored);
      records.forEach((rec) => {
        const icao = rec.icao.toLowerCase();
        if (!this.db.has(icao)) this.userDb.set(icao, rec);
      });
      console.log(
        `Loaded ${this.userDb.size} user aircraft from localStorage (filtered out ${records.length - this.userDb.size} duplicates)`
      );
    } catch (e) {
      console.error('Error loading user aircraft data:', e);
    }
  }

  private saveUserData(): void {
    localStorage.setItem(USER_DB_KEY, JSON.stringify(Array.from(this.userDb.values())));
    if (typeof window !== 'undefined') {
      (window as any).planeAlertUserDb = this.exportUserRecordsAsJsonArray();
    }
    scheduleDebouncedSave(this.debounce, () => this.saveToFile());
  }

  private updateGlobalJson(): void {
    this.currentUserDbJson = this.exportUserRecordsAsJsonArray();
  }

  lookup(icaoHex: string): AircraftRecord | undefined {
    const lower = icaoHex.toLowerCase();
    return this.db.get(lower) || this.userDb.get(lower);
  }

  addRecord(record: AircraftRecord): void {
    const icao = record.icao.toLowerCase();
    if (!this.db.has(icao) && !this.userDb.has(icao)) {
      this.userDb.set(icao, record);
      this.saveUserData();
      this.updateGlobalJson();
      console.log(`✅ Added aircraft ${record.icao} to database (${this.userDb.size} total unknown aircraft)`);
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

  exportUserRecordsAsJsonArray(): string {
    return exportUserRecordsJson(Array.from(this.userDb.values()));
  }

  getDatabaseStats(): { mainDb: number; userDb: number; total: number } {
    return { mainDb: this.db.size, userDb: this.userDb.size, total: this.db.size + this.userDb.size };
  }

  getCurrentUserDbForFile(): string {
    console.log('📋 Copy this content to src/assets/user-aircraft-db.json:');
    const content = this.exportUserRecordsAsJsonArray();
    console.log(content);
    return content;
  }

  downloadDatabaseFile(): void {
    if (typeof window !== 'undefined' && this.userDb.size > 0) {
      downloadJsonFile(this.exportUserRecordsAsJsonArray(), 'user-aircraft-db.json');
      console.log('📥 Automatically downloaded updated user-aircraft-db.json');
    }
  }

  private saveToFile(): void {
    if (typeof window === 'undefined' || this.userDb.size === 0) return;
    if (!isLocalDevHost()) {
      console.log('Skipping /save-db call because app is not running on the local dev server.');
      return;
    }
    postSaveDb(this.exportUserRecordsAsJsonArray(), this.userDb.size);
  }
}
