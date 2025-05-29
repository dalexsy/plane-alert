import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

// Define an interface matching your JSON structure.
export interface Aircraft {
  icao: string;
  reg: string;
  icaotype: string | null;
  year: number | null;
  manufacturer: string | null;
  model: string | null;
  ownop: string;
  faa_pia: boolean;
  faa_ladd: boolean;
  short_type: string | null;
  mil: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MappingService {
  private mappingUrl = 'assets/basic-ac-db.json';
  private mapping$!: Observable<Aircraft[]>;

  constructor(private http: HttpClient) {}

  // getMapping loads the JSON file from the assets folder
  // and caches it using shareReplay.
  getMapping(): Observable<Aircraft[]> {
    if (!this.mapping$) {
      // Load split DB fragments and merge newline-delimited JSON lines
      this.mapping$ = forkJoin([
        this.http.get('assets/basic-ac-db1.json', { responseType: 'text' }),
        this.http.get('assets/basic-ac-db2.json', { responseType: 'text' }),
      ]).pipe(
        map((texts) => {
          const all: Aircraft[] = [];
          texts.forEach((text, idx) => {
            if (text) {
              text
                .split(/\r?\n/)
                .filter((l) => l.trim())
                .forEach((line) => {
                  try {
                    all.push(JSON.parse(line));
                  } catch (e) {
                    /* Error parsing mapping line */
                  }
                });
            } else {
              // Empty mapping file
            }
          });
          return all;
        }),
        shareReplay(1)
      );
    }
    return this.mapping$;
  }
}
