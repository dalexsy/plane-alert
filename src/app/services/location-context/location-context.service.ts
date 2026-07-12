import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import {
  calculateLocationDistance,
  geocodeAddressRemote,
  getCurrentTimeForTimezone,
} from './location-context.util';
import {
  refreshAddressForLocation,
  refreshTimezoneForLocation,
} from './location-context-cache.util';
import {
  formatDateForTimezone,
  formatTimeForTimezone,
} from './location-context-format.util';
import type {
  GeocodeResult,
  LocationContextInfo,
  LocationData,
  TimezoneData,
} from './location-context.types';
export type {
  GeocodeResult,
  LocationContextInfo,
  LocationData,
  TimezoneData,
} from './location-context.types';

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
  private lastTimezoneRequest = { value: 0 };
  private lastAddressRequest = { value: 0 };
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
    return formatTimeForTimezone(this.timezone, options);
  }

  formatDateForLocation(options?: Intl.DateTimeFormatOptions): string {
    return formatDateForTimezone(this.timezone, options);
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
    refreshTimezoneForLocation(
      lat,
      lon,
      this._currentLocation.value.source,
      this.timezoneCache,
      this._timezone,
      this.lastTimezoneRequest,
      this.MIN_REQUEST_INTERVAL,
      this.TIMEZONE_CACHE_TTL
    );
  }

  private refreshAddress(lat: number, lon: number): void {
    refreshAddressForLocation(
      lat,
      lon,
      this._currentLocation.value.source,
      this.geocodingCache,
      this.addressCache,
      this._address,
      this.lastAddressRequest,
      this.MIN_REQUEST_INTERVAL,
      this.ADDRESS_CACHE_TTL
    );
  }
}
