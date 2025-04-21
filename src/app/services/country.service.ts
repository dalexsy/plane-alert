import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CountryService {
  private inverseCountryMapping: { [key: string]: string } = {};
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const response = await fetch(
      'https://esm.sh/i18n-iso-countries@7.14.0/langs/en.json'
    );
    const data = await response.json();
    for (const [code, names] of Object.entries(data.countries || {})) {
      if (typeof names === 'string') {
        this.inverseCountryMapping[names.toLowerCase()] = code;
      } else if (Array.isArray(names)) {
        for (const name of names) {
          this.inverseCountryMapping[name.toLowerCase()] = code;
        }
      }
    }
    this.initialized = true;
  }

  getFlagHTML(origin: string): string {
    if (origin.toLowerCase().includes('kingdom of the netherlands')) {
      return `<span class="fi fi-nl"></span>`;
    }
    if (origin.toLowerCase().includes('republic of moldova')) {
      return `<span class="fi fi-md"></span>`;
    }
    const code = this.inverseCountryMapping[origin.toLowerCase()];
    return code
      ? `<span class="fi fi-${code.toLowerCase()}"></span>`
      : `<span>${origin}</span>`;
  }

  /**
   * Returns the two-letter country code for a given country name if available.
   */
  getCountryCode(origin: string): string | undefined {
    return this.inverseCountryMapping[origin.toLowerCase()];
  }
}
