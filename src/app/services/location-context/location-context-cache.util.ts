import type { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import type { BehaviorSubject } from 'rxjs';
import { resolveTimezoneData } from './location-context.util';
import type { TimezoneData } from './location-context.service';

export function refreshTimezoneForLocation(
  lat: number,
  lon: number,
  source: string,
  timezoneCache: Map<string, { data: TimezoneData; timestamp: number }>,
  timezoneSubject: BehaviorSubject<TimezoneData | null>,
  lastRequest: { value: number },
  minInterval: number,
  cacheTtl: number,
): void {
  if (source === 'default') return;
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = timezoneCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTtl) {
    timezoneSubject.next(cached.data);
    return;
  }
  const now = Date.now();
  if (now - lastRequest.value < minInterval) return;
  lastRequest.value = now;
  const timezone = resolveTimezoneData(lat, lon);
  timezoneCache.set(cacheKey, { data: timezone, timestamp: Date.now() });
  timezoneSubject.next(timezone);
}

export function refreshAddressForLocation(
  lat: number,
  lon: number,
  source: string,
  geocodingCache: GeocodingCacheService,
  addressCache: Map<string, { data: string; timestamp: number }>,
  addressSubject: BehaviorSubject<string | null>,
  lastRequest: { value: number },
  minInterval: number,
  cacheTtl: number,
): void {
  if (source === 'default') return;
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = addressCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTtl) {
    addressSubject.next(cached.data);
    return;
  }
  const now = Date.now();
  if (now - lastRequest.value < minInterval) return;
  lastRequest.value = now;
  geocodingCache
    .reverseGeocode(lat, lon)
    .then((address) => {
      addressCache.set(cacheKey, { data: address, timestamp: Date.now() });
      addressSubject.next(address);
    })
    .catch(() => {
      // Empty when geocode fails — never show lat/lon to users.
      addressCache.set(cacheKey, { data: '', timestamp: Date.now() });
      addressSubject.next('');
    });
}
