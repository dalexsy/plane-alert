import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { GeocodingCacheService } from './geocoding-cache.service';
import {
  calculateLocationDistance,
  geocodeAddressRemote,
  getCurrentTimeForTimezone,
  resolveTimezoneData,
} from './location-context/location-context.util';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName?: string;
  addressDetails?: Record<string, string>;
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

@Injectable({ providedIn: 'root' })
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

  private timezoneCache = new Map<string, { data: TimezoneData; timestamp: number }>();
  private addressCache = new Map<string, { data: string; timestamp: number }>();
  private readonly TIMEZONE_CACHE_TTL = 60 * 60 * 1000;
  private readonly ADDRESS_CACHE_TTL = 30 * 60 * 1000;
  private lastTimezoneRequest = 0;
  private lastAddressRequest = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000;
  private readonly MIN_DISTANCE_THRESHOLD = 0.009;

  constructor(private geocodingCache: GeocodingCacheService) {
    this.addressCache.clear();
    this._currentLocation
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(
          (a, b) =>
            calculateLocationDistance(a.lat || 0, a.lon || 0, b.lat || 0, b.lon || 0) <
            this.MIN_DISTANCE_THRESHOLD
        )
      )
      .subscribe((location) => {
        if (!location.lat || !location.lon) return;
        this.refreshTimezone(location.lat, location.lon);
        if (location.source !== 'default' && !location.address) {
          this.refreshAddress(location.lat, location.lon);
        }
      });
  }

  get currentLocation$(): Observable<LocationData> {
    return this._currentLocation.asObservable();
  }
  get currentLocation(): LocationData {
    return this._currentLocation.value;
  }
  get timezone$(): Observable<TimezoneData | null> {
    return this._timezone.asObservable();
  }
  get timezone(): TimezoneData | null {
    return this._timezone.value;
  }
  get address$(): Observable<string | null> {
    return this._address.asObservable();
  }
  get address(): string | null {
    return this._address.value;
  }
  get locationContext$(): Observable<LocationContextInfo> {
    return combineLatest([this._currentLocation, this._timezone, this._address]).pipe(
      map(([location, timezone, address]) => ({
        location,
        timezone: timezone || undefined,
        address: address || undefined,
      }))
    );
  }

  updateFromMapCenter(lat: number, lon: number, source: 'map' | 'home' | 'current' = 'map'): void {
    this.geocodingCache.reverseGeocode(lat, lon).then((address) => {
      const current = this._currentLocation.value;
      const distance = calculateLocationDistance(
        current.lat || lat,
        current.lon || lon,
        lat,
        lon
      );
      if (distance < this.MIN_DISTANCE_THRESHOLD) return;
      this._currentLocation.next({ address, lat, lon, source, timestamp: Date.now() });
    });
  }

  async updateFromAddress(address: string): Promise<GeocodeResult> {
    const geocodeResult = await this.geocodeAddress(address);
    this._currentLocation.next({
      address,
      lat: geocodeResult.lat,
      lon: geocodeResult.lon,
      source: 'address',
      timestamp: Date.now(),
    });
    return geocodeResult;
  }

  async geocodeAddress(address: string): Promise<GeocodeResult> {
    return geocodeAddressRemote(address);
  }

  getCurrentTimeForLocation(): Date {
    return getCurrentTimeForTimezone(this.timezone);
  }

  formatTimeForLocation(options?: Intl.DateTimeFormatOptions): string {
    return getCurrentTimeForTimezone(this.timezone).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...options,
    });
  }

  formatDateForLocation(options?: Intl.DateTimeFormatOptions): string {
    return getCurrentTimeForTimezone(this.timezone).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...options,
    });
  }

  setAddress(address: string): void {
    this._address.next(address);
  }

  setLocation(
    lat: number,
    lon: number,
    address: string,
    source: 'map' | 'home' | 'default' | 'address' | 'current'
  ): void {
    this._currentLocation.next({ address, lat, lon, source, timestamp: Date.now() });
  }

  getCacheStats(): { timezone: number; address: number } {
    return { timezone: this.timezoneCache.size, address: this.addressCache.size };
  }

  private refreshTimezone(lat: number, lon: number): void {
    if (this._currentLocation.value.source === 'default') return;
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = this.timezoneCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.TIMEZONE_CACHE_TTL) {
      this._timezone.next(cached.data);
      return;
    }
    const now = Date.now();
    if (now - this.lastTimezoneRequest < this.MIN_REQUEST_INTERVAL) return;
    this.lastTimezoneRequest = now;
    const timezone = resolveTimezoneData(lat, lon);
    this.timezoneCache.set(cacheKey, { data: timezone, timestamp: Date.now() });
    this._timezone.next(timezone);
  }

  private refreshAddress(lat: number, lon: number): void {
    if (this._currentLocation.value.source === 'default') return;
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.addressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ADDRESS_CACHE_TTL) {
      this._address.next(cached.data);
      return;
    }
    const now = Date.now();
    if (now - this.lastAddressRequest < this.MIN_REQUEST_INTERVAL) return;
    this.lastAddressRequest = now;
    this.geocodingCache
      .reverseGeocode(lat, lon)
      .then((address) => {
        this.addressCache.set(cacheKey, { data: address, timestamp: Date.now() });
        this._address.next(address);
      })
      .catch(() => {
        const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        this.addressCache.set(cacheKey, { data: fallback, timestamp: Date.now() });
        this._address.next(fallback);
      });
  }
}
