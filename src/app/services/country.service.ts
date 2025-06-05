import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CountryService {
  private inverseCountryMapping: { [key: string]: string } = {};
  private countryNames: { [key: string]: string } = {};
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
        this.countryNames[code] = names;
      } else if (Array.isArray(names)) {
        for (const name of names) {
          this.inverseCountryMapping[name.toLowerCase()] = code;
        }
        // Use the first name as the primary name for this country code
        if (names.length > 0) {
          this.countryNames[code] = names[0];
        }
      }
    }
    this.initialized = true;
  }
  getCountryCode(origin: string): string | undefined {
    const trimmed = origin.trim();
    // If origin is already a two-letter country code, return it
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const code = this.inverseCountryMapping[trimmed.toLowerCase()];
    return code;
  }

  getCountryName(countryCode: string): string | undefined {
    if (!countryCode) return undefined;

    // Normalize the country code to uppercase
    const normalizedCode = countryCode.toUpperCase();

    // Return the country name if we have it
    return this.countryNames[normalizedCode];
  }

  getFlagHTML(origin: string): string {
    // Determine if origin indicates a specific code or name
    if (origin.toLowerCase().includes('kingdom of the netherlands')) {
      return `<span class="fi fi-nl"></span>`;
    }
    if (origin.toLowerCase().includes('republic of moldova')) {
      return `<span class="fi fi-md"></span>`;
    }
    const code = this.getCountryCode(origin);
    return code
      ? `<span class="fi fi-${code.toLowerCase()}" title="${origin}"></span>`
      : `<span>${origin}</span>`;
  }
}
