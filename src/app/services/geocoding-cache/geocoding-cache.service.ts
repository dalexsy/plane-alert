import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { performGeocodeRequest } from '../geocoding/geocoding-fetch.util';

interface CacheEntry {
  address: string;
  timestamp: number;
  promise?: Promise<string>;
}

@Injectable({ providedIn: 'root' })
export class GeocodingCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 60 * 60 * 1000;
  private readonly COORDINATE_PRECISION = 1;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 5000;
  private geocodingEnabled = true;

  constructor(private ngZone: NgZone, private http: HttpClient) {
    if (typeof window !== 'undefined') {
      this.geocodingEnabled = localStorage.getItem('disable-geocoding') !== 'true';
    }
    this.ngZone.runOutsideAngular(() => setInterval(() => this.clearExpiredCache(), this.CACHE_DURATION));
  }

  public async reverseGeocode(lat: number, lon: number): Promise<string> {
    if (!this.geocodingEnabled) return '';
    const now = Date.now();
    const key = `${lat.toFixed(this.COORDINATE_PRECISION)},${lon.toFixed(this.COORDINATE_PRECISION)}`;
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.promise) return entry.promise;
      if (now - entry.timestamp < this.CACHE_DURATION) return Promise.resolve(entry.address);
    }
    const roundedLat = Number(lat.toFixed(this.COORDINATE_PRECISION));
    const roundedLon = Number(lon.toFixed(this.COORDINATE_PRECISION));
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL) {
      await new Promise((r) => setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed));
    }
    const fetchPromise = performGeocodeRequest(this.http, this.ngZone, roundedLat, roundedLon)
      .then((address) => {
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

  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) this.cache.delete(key);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  setGeocodingEnabled(enabled: boolean): void {
    this.geocodingEnabled = enabled;
    if (typeof window !== 'undefined') localStorage.setItem('disable-geocoding', (!enabled).toString());
  }

  isGeocodingEnabled(): boolean {
    return this.geocodingEnabled;
  }

  getCacheStats(): { size: number; pendingRequests: number } {
    return { size: this.cache.size, pendingRequests: 0 };
  }
}
