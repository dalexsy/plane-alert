// src/app/services/helicopter-list.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

// Import static helicopter ICAO list to ensure synchronous loading
import helicopterIcaosData from '../../assets/helicopter-icaos.json';

@Injectable({
  providedIn: 'root',
})
export class HelicopterListService {
  private helicopterIcaos: Set<string> = new Set<string>();
  private customListLoaded = false;
  private listUpdated = new Subject<void>();
  private lastLoadTime = 0;

  // Observable that other components can subscribe to for updates
  public readonly helicopterListUpdated$: Observable<void> =
    this.listUpdated.asObservable();

  constructor(private http: HttpClient) {
    // Load asynchronously, but also apply static list immediately for window view
    this.loadHelicopterList();
    this.helicopterIcaos = new Set(
      helicopterIcaosData.map((icao: string) => icao.toLowerCase())
    );
    this.customListLoaded = true;
    this.listUpdated.next();
  }

  /**
   * Load the list of helicopter ICAOs from the JSON file
   */
  loadHelicopterList(): Promise<void> {
    // Use cache-busting query parameter to prevent browser caching
    const cacheBuster = new Date().getTime();

    return this.http
      .get(`/assets/helicopter-icaos.json?_=${cacheBuster}`, {
        responseType: 'text',
      })
      .toPromise()
      .then((text: string | undefined) => {
        if (!text) {
          return;
        }

        try {
          const icaos = JSON.parse(text);
          this.helicopterIcaos = new Set(
            icaos.map((icao: string) => icao.toLowerCase())
          );
          this.customListLoaded = true;
          this.lastLoadTime = Date.now();

          this.listUpdated.next();
        } catch (e) {
          console.error('Error parsing helicopter-icaos.json:', e);
        }
      })
      .catch((error) => {
        if (error.status === 404) {
        } else {
          console.error('Error loading helicopter list:', error);
        }
      });
  }

  /**
   * Refresh the helicopter list if it's been more than 30 seconds since the last refresh
   * Returns true if a refresh was performed, false if skipped due to throttling
   */
  refreshHelicopterList(force: boolean = false): Promise<boolean> {
    const now = Date.now();
    // Only refresh if it's been at least 30 seconds since the last load, unless forced
    if (force || now - this.lastLoadTime > 30000) {
      return this.loadHelicopterList().then(() => true);
    } else {
      return Promise.resolve(false);
    }
  }

  /**
   * Check if an ICAO should be treated as a helicopter
   */
  isHelicopter(icao: string): boolean {
    // Directly check against loaded ICAO set
    return this.helicopterIcaos.has(icao.trim().toLowerCase());
  }

  /**
   * Get all helicopter ICAOs as an array (useful for debugging)
   */
  getAllHelicopterIcaos(): string[] {
    return Array.from(this.helicopterIcaos);
  }
}
