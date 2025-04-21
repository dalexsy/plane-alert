// src/app/services/helicopter-list.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

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
    this.loadHelicopterList();
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
          console.log('No helicopter-icaos.json file found, using empty list');
          return;
        }

        try {
          const icaos = JSON.parse(text);
          this.helicopterIcaos = new Set(
            icaos.map((icao: string) => icao.toLowerCase())
          );
          this.customListLoaded = true;
          this.lastLoadTime = Date.now();
          console.log(
            `[HelicopterListService] Loaded ${this.helicopterIcaos.size} custom helicopter ICAOs`
          );
          this.listUpdated.next();
        } catch (e) {
          console.error('Error parsing helicopter-icaos.json:', e);
        }
      })
      .catch((error) => {
        if (error.status === 404) {
          console.log('No helicopter-icaos.json file found, using empty list');
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
      console.log('[HelicopterListService] Refreshing helicopter ICAO list');
      return this.loadHelicopterList().then(() => true);
    } else {
      console.log(
        '[HelicopterListService] Skipping refresh, last load too recent'
      );
      return Promise.resolve(false);
    }
  }

  /**
   * Check if an ICAO should be treated as a helicopter
   */
  isHelicopter(icao: string): boolean {
    // Don't check until the list is loaded
    if (!this.customListLoaded) {
      return false;
    }

    return this.helicopterIcaos.has(icao.trim().toLowerCase());
  }

  /**
   * Get all helicopter ICAOs as an array (useful for debugging)
   */
  getAllHelicopterIcaos(): string[] {
    return Array.from(this.helicopterIcaos);
  }
}
