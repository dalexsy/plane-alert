// filepath: src/app/services/unknown-list.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UnknownListService {
  private unknownIcaos: Set<string> = new Set<string>();
  private listUpdated = new Subject<void>();
  private lastLoadTime = 0;
  public readonly unknownListUpdated$: Observable<void> =
    this.listUpdated.asObservable();

  constructor(private http: HttpClient) {
    this.loadUnknownList();
  }

  /** Load the list of unknown device ICAOs from JSON asset */
  loadUnknownList(): Promise<void> {
    const cacheBuster = new Date().getTime();
    return this.http
      .get(`/assets/unknown-device-icaos.json?_=${cacheBuster}`, {
        responseType: 'text',
      })
      .toPromise()
      .then((text: string | undefined) => {
        if (!text) return;
        try {
          const icaos: string[] = JSON.parse(text);
          this.unknownIcaos = new Set(icaos.map((s) => s.trim().toLowerCase()));
          this.lastLoadTime = Date.now();
          this.listUpdated.next();
        } catch {}
      })
      .catch(() => {});
  }

  /** Refresh the list if older than 30s */
  refreshUnknownList(force: boolean = false): Promise<boolean> {
    const now = Date.now();
    if (force || now - this.lastLoadTime > 30000) {
      return this.loadUnknownList().then(() => true);
    }
    return Promise.resolve(false);
  }

  /** Check if ICAO is unknown device */
  isUnknown(icao: string): boolean {
    return this.unknownIcaos.has(icao.trim().toLowerCase());
  }

  getAllUnknownIcaos(): string[] {
    return Array.from(this.unknownIcaos);
  }
}
