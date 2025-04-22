import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SpecialListService {
  private specialIcaos: Set<string> = new Set<string>();
  private customListLoaded = false;
  private listUpdated = new Subject<void>();
  private lastLoadTime = 0;

  public readonly specialListUpdated$: Observable<void> =
    this.listUpdated.asObservable();

  constructor(private http: HttpClient) {
    this.loadSpecialList();
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
          this.customListLoaded = true;
          this.lastLoadTime = Date.now();
          this.listUpdated.next();
        } catch (e) {
          console.error('Error parsing special-icaos.json:', e);
        }
      })
      .catch((error) => {
        if (error.status !== 404)
          console.error('Error loading special list:', error);
      });
  }

  refreshSpecialList(force: boolean = false): Promise<boolean> {
    const now = Date.now();
    if (force || now - this.lastLoadTime > 30000) {
      return this.loadSpecialList().then(() => true);
    }
    return Promise.resolve(false);
  }

  isSpecial(icao: string): boolean {
    if (!this.customListLoaded) return false;
    return this.specialIcaos.has(icao.trim().toLowerCase());
  }

  getAllSpecialIcaos(): string[] {
    return Array.from(this.specialIcaos);
  }
}
