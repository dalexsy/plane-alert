import { Injectable, NgZone } from '@angular/core';

interface CacheEntry {
  address: string;
  timestamp: number;
  promise?: Promise<string>;
}

@Injectable({
  providedIn: 'root',
})
export class GeocodingCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly COORDINATE_PRECISION = 3; // ~100m precision
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

  constructor(private ngZone: NgZone) {
    // Periodically purge expired entries outside Angular to avoid CD overhead
    this.ngZone.runOutsideAngular(() =>
      setInterval(() => this.clearExpiredCache(), this.CACHE_DURATION)
    );
  }

  /**
   * Get geocoded address with caching and request deduplication
   */ async reverseGeocode(lat: number, lon: number): Promise<string> {
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
        if (!entry.address || entry.address.trim() === '') {
          console.log('Returning empty cached result for:', key, entry.address);
        }
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

  private async performRequest(lat: number, lon: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: { 'User-Agent': 'PlaneAlert/1.0' },
        }
      );
      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const addr = data.address || {};
      // Prioritize fine-grained locality fields
      const primary =
        addr.suburb ||
        addr.city_district ||
        addr.city ||
        addr.town ||
        addr.village ||
        '';
      const county = addr.county || '';
      const state = addr.state || '';
      const country = addr.country || ''; // Build best possible description (exclude Germany from display)
      const isGermany = country === 'Germany' || country === 'Deutschland';
      const displayCountry = isGermany ? '' : country;

      if (primary) {
        const parts = [primary, state, displayCountry].filter(Boolean);
        return parts.length > 1
          ? `Near ${parts.join(', ')}`
          : `Near ${parts[0]}`;
      }
      if (county) {
        const parts = [county, state, displayCountry].filter(Boolean);
        return parts.length > 1
          ? `Near ${parts.join(', ')}`
          : `Near ${parts[0]}`;
      }
      if (state) {
        return displayCountry
          ? `Near ${state}, ${displayCountry}`
          : `Near ${state}`;
      }
      if (displayCountry) {
        return displayCountry;
      }
      // Fallback to the display_name or coordinates if absolutely nothing else
      return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch (error) {
      console.warn('Geocoding failed:', error);
      // Fallback to formatted coordinates so UI always has something meaningful
      return `${lat.toFixed(this.COORDINATE_PRECISION)}, ${lon.toFixed(
        this.COORDINATE_PRECISION
      )}`;
    }
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
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; pendingRequests: number } {
    return {
      size: this.cache.size,
      pendingRequests: 0, // No pending requests in simplified version
    };
  }
}
