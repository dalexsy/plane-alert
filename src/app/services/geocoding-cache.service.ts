import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

interface CacheEntry {
  address: string;
  timestamp: number;
  promise?: Promise<string>;
}

interface ReverseGeocodeResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  country?: string;
  localityInfo?: {
    informative?: Array<{ name?: string | null }>;
    administrative?: Array<{ name?: string | null }>;
  };
  address?: {
    road?: string | null;
    house_number?: string | null;
    pedestrian?: string | null;
    path?: string | null;
    neighbourhood?: string | null;
    suburb?: string | null;
    city_district?: string | null;
    city?: string | null;
    town?: string | null;
    village?: string | null;
    municipality?: string | null;
    hamlet?: string | null;
    borough?: string | null;
    region?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
  continent?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeocodingCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache duration
  private readonly COORDINATE_PRECISION = 1; // 1 decimal place = ~10km precision
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 5000; // Minimum 5 seconds between requests (Nominatim requires 1 req/sec max)
  private requestQueue: Array<() => void> = []; // Queue for rate-limited requests
  private isProcessingQueue = false;
  private geocodingEnabled = true; // Can be disabled if APIs are problematic

  constructor(private ngZone: NgZone, private http: HttpClient) {
    // Check if geocoding should be disabled (useful for offline development)
    if (typeof window !== 'undefined') {
      const disableGeocoding = localStorage.getItem('disable-geocoding');
      this.geocodingEnabled = disableGeocoding !== 'true';
    }

    // Periodically purge expired entries outside Angular to avoid CD overhead
    this.ngZone.runOutsideAngular(() =>
      setInterval(() => this.clearExpiredCache(), this.CACHE_DURATION)
    );
  }

  /**
   * Get geocoded address with caching and request deduplication
   */ public async reverseGeocode(lat: number, lon: number): Promise<string> {
    console.log('Geocoding coordinates:', lat, lon);

    // If geocoding is disabled, return coordinates immediately
    if (!this.geocodingEnabled) {
      console.log('Geocoding disabled, returning coordinates');
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }

    const now = Date.now();
    const key = `${lat.toFixed(this.COORDINATE_PRECISION)},${lon.toFixed(
      this.COORDINATE_PRECISION
    )}`;

    // Check cache or in-flight
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.promise) {
        return entry.promise;
      }
      if (now - entry.timestamp < this.CACHE_DURATION) {
        return Promise.resolve(entry.address);
      }
    }

    // Prepare rounded coords
    const roundedLat = Number(lat.toFixed(this.COORDINATE_PRECISION));
    const roundedLon = Number(lon.toFixed(this.COORDINATE_PRECISION));

    // Rate limiting
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL) {
      await new Promise((r) =>
        setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed)
      );
    }

    // Kick off request and cache its promise outside Angular zone
    const fetchPromise = this.ngZone
      .runOutsideAngular(() => this.performRequest(roundedLat, roundedLon))
      .then((address) => {
        if (!address || address.trim() === '') {
          console.log('Empty geocoding result:', address, 'for key:', key);
        }
        this.cache.set(key, { address, timestamp: Date.now() });
        this.lastRequestTime = Date.now();
        return address;
      })
      .catch((err) => {
        this.cache.delete(key);
        throw err;
      });

    this.cache.set(key, { address: '', timestamp: now, promise: fetchPromise });
    return fetchPromise;
  }

  private async performRequest(
    lat: number,
    lon: number,
    retryCount = 0
  ): Promise<string> {
    console.log('Making geocoding API call for:', lat, lon);
    const maxRetries = 2;

    try {
      // Try Nominatim first (better Unicode support, preserves umlauts)
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`;
      const nominatimResponse = await this.ngZone.runOutsideAngular(() =>
        firstValueFrom(this.http.get<any>(nominatimUrl).pipe(timeout(5000)))
      );

      // Build address from Nominatim response
      if (nominatimResponse?.address) {
        const addr = nominatimResponse.address;
        const parts: string[] = [];

        // Add suburb/district/neighbourhood
        const district =
          addr.suburb || addr.city_district || addr.neighbourhood;
        if (district) parts.push(district);

        // Add city/town/village
        const city = addr.city || addr.town || addr.village;
        if (city && city !== district) parts.push(city);

        // Add state if different from city
        if (addr.state && addr.state !== city) {
          parts.push(addr.state);
        }

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }

      // Fallback to BigDataCloud if Nominatim fails
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const response = await this.ngZone.runOutsideAngular(() =>
        firstValueFrom(
          this.http.get<ReverseGeocodeResponse>(url).pipe(timeout(5000))
        )
      );

      const formatted = this.buildAddressString(response);
      if (
        formatted?.toLowerCase().includes('europe') ||
        formatted?.toLowerCase().includes('berlin, berlin')
      ) {
        console.log('Geocoding format debug', {
          formatted,
          locality: response.locality,
          city: response.city,
          principalSubdivision: response.principalSubdivision,
          country: response.countryName || response.country,
          informative: response.localityInfo?.informative,
          administrative: response.localityInfo?.administrative,
          address: response.address,
        });
      }
      if (formatted) {
        return formatted;
      }

      return (
        response.locality ||
        response.city ||
        response.principalSubdivision ||
        `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      );
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('europe')) {
        console.log('Geocoding fallback triggered', { error, lat, lon });
      }
      // Retry logic for network/CORS issues
      if (
        retryCount < maxRetries &&
        (error.message?.includes('Http failure response') ||
          error.message?.includes('TimeoutError') ||
          error.name === 'TimeoutError' ||
          error.status === 0) // CORS/network error
      ) {
        console.warn(
          `Geocoding attempt ${retryCount + 1} failed, retrying...`,
          error.message
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        ); // Exponential backoff
        return this.performRequest(lat, lon, retryCount + 1);
      }

      // Specific handling for rate limiting (403) and network errors
      if (error.status === 403) {
        console.warn(
          'Geocoding rate limited (403). Caching will reduce future requests.'
        );
      } else if (
        error.message &&
        (error.message.includes('Http failure response') ||
          error.message.includes('TimeoutError') ||
          error.name === 'TimeoutError' ||
          error.status === 0)
      ) {
        console.warn('Geocoding request timed out or failed (network issue).');
      } else {
        console.warn('Geocoding failed:', error);
      }

      // Return a user-friendly fallback instead of coordinates
      // This will be cached to prevent repeated failed requests
      const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      const cacheKey = `${lat.toFixed(this.COORDINATE_PRECISION)},${lon.toFixed(
        this.COORDINATE_PRECISION
      )}`;
      this.cache.set(cacheKey, {
        address: fallback,
        timestamp: Date.now(),
      });

      return fallback;
    }
  }

  private buildAddressString(response: ReverseGeocodeResponse): string | null {
    const parts: string[] = [];
    const seen = new Set<string>();

    const genericTerms = new Set([
      'nearby area',
      'unnamed road',
      'unknown',
      'general',
      'world',
      'earth',
      'continent',
    ]);

    const normalizeKey = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '');

    const isGeneric = (candidate: string) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return true;
      }

      const normalized = normalizeKey(trimmed);

      if (genericTerms.has(normalized)) {
        return true;
      }

      if (normalized === response.continent?.toLowerCase()) {
        return true;
      }

      const continentTokens = [
        'europe',
        'asia',
        'africa',
        'australia',
        'oceania',
        'antarctica',
      ];
      if (
        continentTokens.some(
          (token) => normalized === token || normalized.startsWith(`${token}/`)
        )
      ) {
        return true;
      }

      if (normalized.endsWith(' continent') || normalized.endsWith(' region')) {
        return true;
      }

      return false;
    };

    const addPart = (raw?: string | null) => {
      if (!raw) {
        return;
      }
      const trimmed = raw.trim();
      if (!trimmed || isGeneric(trimmed)) {
        return;
      }
      const key = normalizeKey(trimmed);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      parts.push(trimmed);
    };

    const address = response.address || {};
    const administrative = response.localityInfo?.administrative ?? [];

    const getAdministrativeFromEnd = (offset: number): string | undefined => {
      if (!administrative.length) {
        return undefined;
      }
      const index = administrative.length - 1 - offset;
      if (index < 0 || index >= administrative.length) {
        return undefined;
      }
      const name = administrative[index]?.name?.trim();
      if (!name || isGeneric(name)) {
        return undefined;
      }
      return name;
    };

    const pickFirstValid = (
      candidates: Array<string | null | undefined>
    ): string | undefined => {
      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed || isGeneric(trimmed)) {
          continue;
        }
        return trimmed;
      }
      return undefined;
    };

    const road = pickFirstValid([
      address.road,
      address.pedestrian,
      address.path,
      address.neighbourhood,
      address.hamlet,
    ]);

    const houseNumber = address.house_number?.trim();
    if (road) {
      addPart(houseNumber ? `${road} ${houseNumber}` : road);
    } else if (houseNumber) {
      addPart(houseNumber);
    }

    let locality = pickFirstValid([
      address.city,
      address.town,
      address.village,
      address.municipality,
      response.city,
      response.locality,
      getAdministrativeFromEnd(0),
    ]);

    let subLocality = pickFirstValid([
      address.suburb,
      address.city_district,
      address.borough,
      address.neighbourhood,
      getAdministrativeFromEnd(locality ? 1 : 0),
    ]);

    if (locality && subLocality) {
      const localityKey = normalizeKey(locality);
      const subLocalityKey = normalizeKey(subLocality);
      if (localityKey === subLocalityKey) {
        subLocality = undefined;
      }
    }

    addPart(subLocality);
    addPart(locality);

    const state = pickFirstValid([
      address.state,
      address.region,
      response.principalSubdivision,
      getAdministrativeFromEnd(locality ? 1 : 0),
      getAdministrativeFromEnd(1),
    ]);
    addPart(state);

    const country = pickFirstValid([
      address.country,
      response.countryName,
      response.country,
      getAdministrativeFromEnd(administrative.length - 1),
    ]);
    addPart(country);

    if (!parts.length) {
      addPart(address.postcode);
    }

    const finalParts: string[] = [];
    const finalSeen = new Set<string>();

    for (const part of parts) {
      const key = normalizeKey(part);
      if (!part || isGeneric(part) || finalSeen.has(key)) {
        continue;
      }
      finalSeen.add(key);
      finalParts.push(part);
    }

    if (
      finalParts.some((part) => part.toLowerCase().includes('europe')) ||
      finalParts.filter((part) => normalizeKey(part).includes('berlin'))
        .length > 1
    ) {
      console.log('Geocoding parts debug', {
        parts,
        finalParts,
        locality,
        subLocality,
        state,
        country,
        road,
        houseNumber,
        administrative,
        response,
      });
    }

    return finalParts.length > 0 ? finalParts.join(', ') : null;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Enable or disable geocoding (useful for offline development or API issues)
   */
  setGeocodingEnabled(enabled: boolean): void {
    this.geocodingEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('disable-geocoding', (!enabled).toString());
    }
    console.log(`Geocoding ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if geocoding is currently enabled
   */
  isGeocodingEnabled(): boolean {
    return this.geocodingEnabled;
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; pendingRequests: number } {
    return {
      size: this.cache.size,
      pendingRequests: 0, // No pending requests in simplified version
    };
  }
}
