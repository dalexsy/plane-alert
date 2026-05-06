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
import { GeocodingCacheService } from './geocoding-cache.service';
import { resolveTimezoneForCoordinates } from '../utils/timezone.util';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName?: string;
  addressDetails?: {
    road?: string;
    pedestrian?: string;
    cycleway?: string;
    footway?: string;
    residential?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    municipality?: string;
    county?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export interface LocationData {
  address: string;
  lat?: number;
  lon?: number;
  source: 'map' | 'home' | 'default' | 'address' | 'current';
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
    address: 'Berlin, Germany',
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

  constructor(
    private http: HttpClient,
    private geocodingCache: GeocodingCacheService
  ) {
    // Clear address cache since we're now using GeocodingCacheService
    this.addressCache.clear();
    // Debounce location changes to prevent excessive API calls
    this._currentLocation
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(
          (a, b) =>
            this.calculateDistance(
              a.lat || 0,
              a.lon || 0,
              b.lat || 0,
              b.lon || 0
            ) < this.MIN_DISTANCE_THRESHOLD
        )
      )
      .subscribe((location) => {
        if (location.lat && location.lon) {
          this.updateTimezone(location.lat, location.lon);
          // Only update address if we don't already have one and source isn't default
          // This prevents reverse-geocoding when we already set an address via setLocation()
          if (location.source !== 'default' && !location.address) {
            this.updateAddress(location.lat, location.lon);
          }
        }
      });
  }

  /**
   * Parse UTC offset string like "+05:30" or "-08:00" to hours
   */
  private parseUtcOffset(offsetString: string): number {
    if (!offsetString) return 0;
    const match = offsetString.match(/([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    return sign * (hours + minutes / 60);
  }

  /**
   * Find the nearest timezone to given coordinates using major city lookup
   */
  private findNearestTimezone(lat: number, lon: number): string | null {
    // Major timezone reference points with their IANA timezone identifiers
    const timezonePoints = [
      // Europe
      { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
      { lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
      { lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
      { lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow' },

      // North America
      { lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
      { lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
      { lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
      { lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },

      // Asia
      { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
      { lat: 39.9042, lon: 116.4074, tz: 'Asia/Shanghai' },
      { lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' },
      { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },

      // Australia/Oceania
      { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
      { lat: -37.8136, lon: 144.9631, tz: 'Australia/Melbourne' },

      // South America
      { lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo' },
      { lat: -34.6118, lon: -58.396, tz: 'America/Argentina/Buenos_Aires' },

      // Africa
      { lat: -26.2041, lon: 28.0473, tz: 'Africa/Johannesburg' },
      { lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' },
    ];

    let nearest = null;
    let minDistance = Infinity;

    for (const point of timezonePoints) {
      const distance = this.calculateDistance(lat, lon, point.lat, point.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point.tz;
      }
    }

    // Only use if reasonably close (within ~20 degrees)
    return minDistance < 20 ? nearest : null;
  }

  /**
   * Determine if DST is likely active for a given location
   */
  private isDSTActive(lat: number, lon: number, baseOffset: number): boolean {
    // This is now just a placeholder since the browser's Intl.DateTimeFormat
    // automatically handles DST when we use proper timezone names
    return false;
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
  updateFromMapCenter(
    lat: number,
    lon: number,
    source: 'map' | 'home' | 'current' = 'map'
  ): void {
    // Geocode the coordinates to get the address
    this.geocodingCache
      .reverseGeocode(lat, lon)
      .then((address) => {
        const currentLocation = this._currentLocation.value;

        // Check if the movement is significant enough to warrant an update
        const distance = this.calculateDistance(
          currentLocation.lat || lat,
          currentLocation.lon || lon,
          lat,
          lon
        );
        if (distance < this.MIN_DISTANCE_THRESHOLD) {
          return; // Don't update for small movements
        }

        this._currentLocation.next({
          address,
          lat,
          lon,
          source,
          timestamp: Date.now(),
        });
      })
      .catch((error) => {
        console.warn('Failed to geocode map center:', error);
      });
  }

  /**
   * Update current location from address string
   */
  async updateFromAddress(address: string): Promise<GeocodeResult> {
    // Geocode the address to get coordinates
    try {
      const geocodeResult = await this.geocodeAddress(address);
      this._currentLocation.next({
        address,
        lat: geocodeResult.lat,
        lon: geocodeResult.lon,
        source: 'address',
        timestamp: Date.now(),
      });
      return geocodeResult;
    } catch (error) {
      console.warn('Failed to geocode address:', error);
      throw error; // Re-throw so caller can handle it
    }
  }

  /**
   * Geocode an address string to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    // Use Nominatim (OpenStreetMap) - free, no API key required
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address
    )}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Nominatim requires a User-Agent header
        'User-Agent': 'PlaneAlert/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.length === 0) {
      throw new Error('No results found for address');
    }

    const result = data[0];

    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      addressDetails: result.address,
    };
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

    void resolveTimezoneForCoordinates(lat, lon)
      .then((resolvedTimezone) => {
        if (resolvedTimezone) {
          this.timezoneCache.set(cacheKey, {
            data: resolvedTimezone,
            timestamp: Date.now(),
          });
          this._timezone.next(resolvedTimezone);
          return;
        }

        const fallbackTimezone = this.buildFallbackTimezone(lat, lon);
        this.timezoneCache.set(cacheKey, {
          data: fallbackTimezone,
          timestamp: Date.now(),
        });
        this._timezone.next(fallbackTimezone);
      })
      .catch(() => {
        const fallbackTimezone = this.buildFallbackTimezone(lat, lon);
        this.timezoneCache.set(cacheKey, {
          data: fallbackTimezone,
          timestamp: Date.now(),
        });
        this._timezone.next(fallbackTimezone);
      });
  }

  private buildFallbackTimezone(lat: number, lon: number): TimezoneData {
    const nearestTimezone = this.findNearestTimezone(lat, lon);

    if (nearestTimezone) {
      return {
        timezone: nearestTimezone,
        utcOffset: lon / 15,
        dst: false,
      };
    }

    let estimatedOffset = lon / 15;
    estimatedOffset = Math.round(estimatedOffset * 2) / 2;
    estimatedOffset = Math.max(-12, Math.min(14, estimatedOffset));

    return {
      timezone: `UTC${estimatedOffset >= 0 ? '+' : ''}${estimatedOffset}`,
      utcOffset: estimatedOffset,
      dst: false,
    };
  }

  /**
   * Get address for location with caching and rate limiting
   */
  private updateAddress(lat: number, lon: number): void {
    // Skip geocoding for default locations
    if (this._currentLocation.value.source === 'default') {
      return;
    }

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

    // Use GeocodingCacheService for consistent geocoding
    this.geocodingCache
      .reverseGeocode(lat, lon)
      .then((address) => {
        // Cache the result
        this.addressCache.set(cacheKey, {
          data: address,
          timestamp: Date.now(),
        });
        this._address.next(address);
      })
      .catch((error) => {
        console.warn('LocationContext geocoding failed:', error);
        // Fallback to coordinates
        const fallbackAddress = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        this.addressCache.set(cacheKey, {
          data: fallbackAddress,
          timestamp: Date.now(),
        });
        this._address.next(fallbackAddress);
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

    // If we have a proper IANA timezone name, use the browser's built-in support
    if (timezone.timezone && timezone.timezone.includes('/')) {
      try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(now);

        const getPart = (type: Intl.DateTimeFormatPartTypes): number =>
          Number.parseInt(
            parts.find((part) => part.type === type)?.value ?? '0',
            10,
          );

        return new Date(
          getPart('year'),
          getPart('month') - 1,
          getPart('day'),
          getPart('hour'),
          getPart('minute'),
          getPart('second'),
        );
      } catch (error) {
        console.warn(
          'Failed to use timezone name, falling back to offset calculation'
        );
      }
    }

    // Fallback to offset calculation
    const now = new Date();
    const browserOffsetMinutes = now.getTimezoneOffset();
    const locationOffsetMinutes = timezone.utcOffset * 60;
    const timeDifferenceMs =
      (locationOffsetMinutes + browserOffsetMinutes) * 60000;
    return new Date(now.getTime() + timeDifferenceMs);
  }

  /**
   * Format time for current location
   */
  formatTimeForLocation(options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    if (this.timezone?.timezone && this.timezone.timezone.includes('/')) {
      return new Intl.DateTimeFormat('en-GB', {
        ...defaultOptions,
        ...options,
        timeZone: this.timezone.timezone,
      }).format(new Date());
    }

    return this.getCurrentTimeForLocation().toLocaleTimeString('en-GB', {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Format date for current location
   */
  formatDateForLocation(options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = options ?? {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };

    if (this.timezone?.timezone && this.timezone.timezone.includes('/')) {
      return new Intl.DateTimeFormat('en-GB', {
        ...defaultOptions,
        timeZone: this.timezone.timezone,
      }).format(new Date());
    }

    return this.getCurrentTimeForLocation().toLocaleDateString('en-GB', {
      ...defaultOptions,
    });
  }

  /**
   * Set the address without geocoding
   */
  setAddress(address: string): void {
    this._address.next(address);
  }

  /**
   * Set location directly with all components (used when we already have the address)
   */
  setLocation(
    lat: number,
    lon: number,
    address: string,
    source: 'map' | 'home' | 'default' | 'address' | 'current'
  ): void {
    this._currentLocation.next({
      address,
      lat,
      lon,
      source,
      timestamp: Date.now(),
    });
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
