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
      // Try primary geocoding service (Nominatim)
      let url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

      let response = await this.ngZone.runOutsideAngular(() =>
        this.http
          .get<any>(url)
          .pipe(
            timeout(5000), // Reduced timeout to 5 seconds
            map((response) => response),
            catchError((error) => {
              throw error;
            })
          )
          .toPromise()
      );

      // If Nominatim fails with 504, try alternative geocoding service
      if (!response || response.error) {
        console.log(
          'Nominatim failed, trying alternative geocoding service...'
        );
        // Fallback to a different geocoding service or simplified response
        url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

        try {
          response = await this.ngZone.runOutsideAngular(() =>
            this.http
              .get<any>(url)
              .pipe(
                timeout(3000),
                map((response) => response),
                catchError((error) => {
                  throw error;
                })
              )
              .toPromise()
          );
        } catch (fallbackError: any) {
          console.warn(
            'Alternative geocoding service also failed:',
            fallbackError.message
          );
          // Return coordinates as fallback
          return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
      }

      const addr = response.address || {};
      // Build address using same logic as LocationContext for consistency
      const components = [
        addr.road || addr.localityInfo?.administrative?.[2]?.name,
        addr.house_number,
        addr.suburb || addr.city_district || addr.neighbourhood || addr.city,
        addr.city ||
          addr.town ||
          addr.village ||
          addr.localityInfo?.administrative?.[1]?.name,
        addr.country || addr.countryName,
      ].filter(Boolean);

      if (components.length > 0) {
        return components.join(', ');
      }
      // Fallback to the display_name or coordinates if absolutely nothing else
      return (
        response.display_name ||
        response.city ||
        `${lat.toFixed(5)}, ${lon.toFixed(5)}`
      );
    } catch (error: any) {
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
      const nearbyAreaText = 'Nearby area';

      // Cache the fallback so we don't keep retrying
      const cacheKey = `${lat.toFixed(this.COORDINATE_PRECISION)},${lon.toFixed(
        this.COORDINATE_PRECISION
      )}`;
      this.cache.set(cacheKey, {
        address: nearbyAreaText,
        timestamp: Date.now(),
      });

      return nearbyAreaText;
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
