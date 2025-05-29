import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SpecialListService {
  private specialIcaos: Set<string> = new Set<string>();
  // Custom user-marked specials stored in localStorage
  private readonly localStorageKey = 'specialIcaos_custom';
  private customSpecialIcaos: Set<string> = new Set<string>();
  // Combined set of asset-loaded and custom ICAOs
  private combinedIcaos: Set<string> = new Set<string>();
  private customListLoaded = false;
  private listUpdated = new Subject<void>();
  private lastLoadTime = 0;

  public readonly specialListUpdated$: Observable<void> =
    this.listUpdated.asObservable();

  constructor(private http: HttpClient) {
    this.loadCustomList();
    this.loadSpecialList();
  }

  /** Load custom list from localStorage */
  private loadCustomList(): void {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        const arr: string[] = JSON.parse(stored);
        this.customSpecialIcaos = new Set(arr.map((s) => s.toLowerCase()));
      } catch {
        this.customSpecialIcaos = new Set();
      }
    }
    // debug log removed
  }

  /** Merge asset and custom lists and notify subscribers */
  private mergeLists(): void {
    this.combinedIcaos = new Set([
      ...Array.from(this.specialIcaos),
      ...Array.from(this.customSpecialIcaos),
    ]);
    // debug log removed
    this.listUpdated.next();
  }

  loadSpecialList(): Promise<void> {
    const cacheBuster = new Date().getTime();
    return this.http
      .get(`/assets/special-icaos.json?_=${cacheBuster}`, {
        responseType: 'text',
      })
      .toPromise()
      .then((text: string | undefined) => {
        if (!text) return;
        try {
          const icaos: string[] = JSON.parse(text);
          this.specialIcaos = new Set(icaos.map((s) => s.toLowerCase()));
          this.lastLoadTime = Date.now();
          this.mergeLists();
        } catch (e) {
          // Error parsing special-icaos.json
        }
      })
      .catch((error) => {
        if (error.status !== 404) {
          // Error loading special list
        }
      });
  }

  /** Refresh the asset special list, throttled to 30s */
  refreshSpecialList(force: boolean = false): Promise<boolean> {
    const now = Date.now();
    if (force || now - this.lastLoadTime > 30000) {
      return this.loadSpecialList().then(() => true);
    }
    return Promise.resolve(false);
  }

  /** Add plane ICAO to custom special list */
  addSpecial(icao: string): void {
    const key = icao.trim().toLowerCase();
    // debug log removed
    if (!this.customSpecialIcaos.has(key)) {
      this.customSpecialIcaos.add(key);
      localStorage.setItem(
        this.localStorageKey,
        JSON.stringify(Array.from(this.customSpecialIcaos))
      );
      this.mergeLists();
    }
  }

  /** Remove plane ICAO from custom special list */
  removeSpecial(icao: string): void {
    const key = icao.trim().toLowerCase();
    // debug log removed
    if (this.customSpecialIcaos.delete(key)) {
      localStorage.setItem(
        this.localStorageKey,
        JSON.stringify(Array.from(this.customSpecialIcaos))
      );
      this.mergeLists();
    }
  }

  /** Toggle plane ICAO in custom special list */
  toggleSpecial(icao: string): void {
    const key = icao.trim().toLowerCase();
    if (this.customSpecialIcaos.has(key)) {
      this.removeSpecial(icao);
    } else {
      this.addSpecial(icao);
    }
  }

  isSpecial(icao: string): boolean {
    return this.combinedIcaos.has(icao.trim().toLowerCase());
  }

  getAllSpecialIcaos(): string[] {
    return Array.from(this.combinedIcaos);
  }
}
