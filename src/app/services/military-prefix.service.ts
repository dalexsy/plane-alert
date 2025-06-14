import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_BASE_HREF } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class MilitaryPrefixService {
  private prefixes: string[] = [];
  private loaded = false;

  constructor(private http: HttpClient, @Inject(APP_BASE_HREF) private baseHref: string) {}

  loadPrefixes(): Promise<void> {
    if (this.loaded) {
      return Promise.resolve();
    }
    return this.http
      .get<string[]>(`${this.baseHref}/assets/military-prefixes.json`)
      .toPromise()
      .then(list => {
        this.prefixes = (list || []).map(p => p.toUpperCase());
        this.loaded = true;
      })
      .catch(() => {
        this.prefixes = [];
        this.loaded = true;
      });
  }

  isMilitaryCallsign(callsign: string): boolean {
    if (!callsign) return false;
    const norm = callsign.trim().toUpperCase();
    return this.prefixes.some(prefix => norm.startsWith(prefix));
  }

  getAllPrefixes(): string[] {
    return [...this.prefixes];
  }
}
