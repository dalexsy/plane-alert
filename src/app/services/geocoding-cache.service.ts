import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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

  constructor(private ngZone: NgZone, private http: HttpClient) {
    // Periodically purge expired entries outside Angular to avoid CD overhead
    this.ngZone.runOutsideAngular(() =>
      setInterval(() => this.clearExpiredCache(), this.CACHE_DURATION)
    );
  }

  /**
   * Get geocoded address with caching and request deduplication
   */ public async reverseGeocode(lat: number, lon: number): Promise<string> {
    console.log('Geocoding coordinates:', lat, lon);
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

  private async performRequest(lat: number, lon: number): Promise<string> {
    console.log('Making geocoding API call for:', lat, lon);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

      const data = await this.ngZone.runOutsideAngular(() =>
        this.http
          .get<any>(url)
          .pipe(
            timeout(5000), // 5 second timeout
            map((response) => response),
            catchError((error) => {
              throw error;
            })
          )
          .toPromise()
      );

      const addr = data.address || {};
      // Build address using same logic as LocationContext for consistency
      const components = [
        addr.road,
        addr.house_number,
        addr.suburb || addr.city_district || addr.neighbourhood,
        addr.city || addr.town || addr.village,
        addr.country,
      ].filter(Boolean);

      if (components.length > 0) {
        return components.join(', ');
      }
      // Fallback to the display_name or coordinates if absolutely nothing else
      return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch (error: any) {
      // Specific handling for CORS/network errors
      if (
        error.message &&
        (error.message.includes('Http failure response') ||
          error.message.includes('TimeoutError') ||
          error.name === 'TimeoutError')
      ) {
        console.warn(
          'Geocoding request timed out or failed. Using coordinates fallback.'
        );
      } else {
        console.warn('Geocoding failed:', error);
      }

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
