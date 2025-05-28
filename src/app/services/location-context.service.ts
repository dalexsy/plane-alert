import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  catchError,
  of,
  tap,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface LocationData {
  lat: number;
  lon: number;
  source: 'map' | 'home' | 'default';
  timestamp: number;
}

export interface TimezoneData {
  timezone: string;
  utcOffset: number;
  dst: boolean;
}

export interface LocationContextInfo {
  location: LocationData;
  timezone?: TimezoneData;
  address?: string;
}

/**
 * Enterprise-grade Location Context Service
 *
 * Provides unified location management for weather, time, and astronomical calculations.
 * Implements caching, fallbacks, and error handling for production use.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationContextService {
  private readonly _currentLocation = new BehaviorSubject<LocationData>({
    lat: 52.52,
    lon: 13.405,
    source: 'default',
    timestamp: Date.now(),
  });

  private readonly _timezone = new BehaviorSubject<TimezoneData | null>(null);
  private readonly _address = new BehaviorSubject<string | null>(null);

  // Cache for timezone lookups
  private timezoneCache = new Map<
    string,
    { data: TimezoneData; timestamp: number }
  >();
  private addressCache = new Map<string, { data: string; timestamp: number }>();

  // Cache TTL: 1 hour for timezone, 30 minutes for addresses
  private readonly TIMEZONE_CACHE_TTL = 60 * 60 * 1000;
  private readonly ADDRESS_CACHE_TTL = 30 * 60 * 1000;
  // Rate limiting
  private lastTimezoneRequest = 0;
  private lastAddressRequest = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

  // Distance threshold: only update if moved more than ~1km (approximately 0.009 degrees)
  private readonly MIN_DISTANCE_THRESHOLD = 0.009;
  constructor(private http: HttpClient) {
    // Debounce location changes to prevent excessive API calls
    this._currentLocation
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(
          (a, b) =>
            this.calculateDistance(a.lat, a.lon, b.lat, b.lon) <
            this.MIN_DISTANCE_THRESHOLD
        )
      )
      .subscribe((location) => {
        this.updateTimezone(location.lat, location.lon);
        this.updateAddress(location.lat, location.lon);
      });
  }

  /**
   * Calculate distance between two points in degrees
   * Approximates distance using Euclidean distance for short distances
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const deltaLat = lat1 - lat2;
    const deltaLon = lon1 - lon2;
    return Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
  }

  /**
   * Get current location as observable
   */
  get currentLocation$(): Observable<LocationData> {
    return this._currentLocation.asObservable();
  }

  /**
   * Get current location value
   */
  get currentLocation(): LocationData {
    return this._currentLocation.value;
  }

  /**
   * Get timezone data as observable
   */
  get timezone$(): Observable<TimezoneData | null> {
    return this._timezone.asObservable();
  }

  /**
   * Get current timezone value
   */
  get timezone(): TimezoneData | null {
    return this._timezone.value;
  }

  /**
   * Get address as observable
   */
  get address$(): Observable<string | null> {
    return this._address.asObservable();
  }

  /**
   * Get current address value
   */
  get address(): string | null {
    return this._address.value;
  }

  /**
   * Get complete location context
   */
  get locationContext$(): Observable<LocationContextInfo> {
    return combineLatest([
      this._currentLocation,
      this._timezone,
      this._address,
    ]).pipe(
      map(([location, timezone, address]) => ({
        location,
        timezone: timezone || undefined,
        address: address || undefined,
      }))
    );
  }
  /**
   * Update current location from map center
   * Only updates if the distance moved is significant enough
   */
  updateFromMapCenter(lat: number, lon: number): void {
    const currentLocation = this._currentLocation.value;

    // Check if the movement is significant enough to warrant an update
    const distance = this.calculateDistance(
      currentLocation.lat,
      currentLocation.lon,
      lat,
      lon
    );
    if (distance < this.MIN_DISTANCE_THRESHOLD) {
      return; // Don't update for small movements
    }

    this._currentLocation.next({
      lat,
      lon,
      source: 'map',
      timestamp: Date.now(),
    });
  }

  /**
   * Update current location from home setting
   */
  updateFromHome(lat: number, lon: number): void {
    this._currentLocation.next({
      lat,
      lon,
      source: 'home',
      timestamp: Date.now(),
    });
  }

  /**
   * Get timezone for location with caching and rate limiting
   */
  private updateTimezone(lat: number, lon: number): void {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = this.timezoneCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() - cached.timestamp < this.TIMEZONE_CACHE_TTL) {
      this._timezone.next(cached.data);
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastTimezoneRequest < this.MIN_REQUEST_INTERVAL) {
      return;
    }
    this.lastTimezoneRequest = now;

    // Use TimeAPI for timezone lookup (free, no API key required)
    const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`;
    this.http
      .get<any>(url)
      .pipe(
        map((response) => {
          console.log('TimeAPI response:', response); // Debug log
          const timezone: TimezoneData = {
            timezone: response.timeZone || 'UTC',
            utcOffset: response.currentUtcOffset?.seconds
              ? response.currentUtcOffset.seconds / 3600
              : 0,
            dst: response.dstActive || false,
          };
          console.log('Parsed timezone data:', timezone); // Debug log
          return timezone;
        }),
        catchError((error) => {
          console.warn('Timezone lookup failed, using fallback:', error);
          // Fallback: rough timezone estimation based on longitude
          const estimatedOffset = Math.round(lon / 15);
          return of({
            timezone: `UTC${estimatedOffset >= 0 ? '+' : ''}${estimatedOffset}`,
            utcOffset: estimatedOffset,
            dst: false,
          });
        }),
        tap((timezone) => {
          // Cache the result
          this.timezoneCache.set(cacheKey, {
            data: timezone,
            timestamp: Date.now(),
          });
        })
      )
      .subscribe((timezone) => {
        this._timezone.next(timezone);
      });
  }

  /**
   * Get address for location with caching and rate limiting
   */
  private updateAddress(lat: number, lon: number): void {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.addressCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() - cached.timestamp < this.ADDRESS_CACHE_TTL) {
      this._address.next(cached.data);
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastAddressRequest < this.MIN_REQUEST_INTERVAL) {
      return;
    }
    this.lastAddressRequest = now;

    // Use Nominatim for reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    this.http
      .get<any>(url)
      .pipe(
        map((response) => {
          const addr = response.address || {};
          const components = [
            addr.road,
            addr.house_number,
            addr.suburb || addr.city_district || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.country,
          ].filter(Boolean);

          return components.length > 0
            ? components.join(', ')
            : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }),
        catchError((error) => {
          console.warn('Address lookup failed, using coordinates:', error);
          return of(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }),
        tap((address) => {
          // Cache the result
          this.addressCache.set(cacheKey, {
            data: address,
            timestamp: Date.now(),
          });
        })
      )
      .subscribe((address) => {
        this._address.next(address);
      });
  }
  /**
   * Get current time for the location
   */
  getCurrentTimeForLocation(): Date {
    const timezone = this.timezone;
    if (!timezone) {
      return new Date();
    }

    // Get current UTC time
    const now = new Date();
    const browserOffset = now.getTimezoneOffset(); // Browser offset in minutes from UTC
    const utcTime = new Date(now.getTime() + browserOffset * 60000);

    // Apply the location's timezone offset (convert hours to milliseconds)
    const locationTime = new Date(
      utcTime.getTime() + timezone.utcOffset * 3600000
    );

    return locationTime;
  }

  /**
   * Format time for current location
   */
  formatTimeForLocation(options?: Intl.DateTimeFormatOptions): string {
    const locationTime = this.getCurrentTimeForLocation();
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    return locationTime.toLocaleTimeString('en-GB', {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Format date for current location
   */
  formatDateForLocation(options?: Intl.DateTimeFormatOptions): string {
    const locationTime = this.getCurrentTimeForLocation();
    const defaultOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };

    return locationTime.toLocaleDateString('en-GB', {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Clear all caches (useful for testing or manual refresh)
   */
  clearCaches(): void {
    this.timezoneCache.clear();
    this.addressCache.clear();

    // Force refresh current location
    const current = this._currentLocation.value;
    this.updateTimezone(current.lat, current.lon);
    this.updateAddress(current.lat, current.lon);
  }

  /**
   * Get cache stats (for debugging/monitoring)
   */
  getCacheStats(): { timezone: number; address: number } {
    return {
      timezone: this.timezoneCache.size,
      address: this.addressCache.size,
    };
  }
}
