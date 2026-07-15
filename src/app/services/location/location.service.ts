import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, timeout } from 'rxjs';
import { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import {
  calculateDistanceMeters,
  forwardGeocodeAddress,
  type GeocodeResult,
} from './location-geocode.util';

export type { GeocodeResult } from './location-geocode.util';

interface LocationResponse {
  address: {
    road?: string;
    suburb?: string;
    city_district?: string;
    town?: string;
    village?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor(
    private http: HttpClient,
    private geocodingCache: GeocodingCacheService
  ) {}

  getLocationInfo(
    lat: number,
    lng: number
  ): Observable<{ street: string | null; district: string | null }> {
    // Pi reverseGeocode — never /nominatim (504 Gateway Timeout on production)
    const url = `/api/planes/reverseGeocode?lat=${lat}&lon=${lng}`;

    return this.http
      .get<{
        address?: string;
        addressDetails?: LocationResponse['address'] | null;
      }>(url)
      .pipe(
        timeout(8000),
        map((response) => {
          const details = response.addressDetails;
          if (!details) {
            return { street: null, district: response.address || null };
          }
          const street = details.road || null;
          const district =
            details.suburb ||
            details.city_district ||
            details.town ||
            details.village ||
            null;
          return { street, district };
        }),
        catchError(() => of({ street: null, district: null }))
      );
  }

  reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }

  forwardGeocode(address: string): Promise<GeocodeResult | null> {
    return forwardGeocodeAddress(address);
  }

  getCurrentLocation(): Promise<{ lat: number; lon: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.debug('Geolocation failed:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }

  checkAutoLocationUpdate(
    currentLat: number,
    currentLon: number,
    thresholdMeters: number = 10
  ): Promise<{ lat: number; lon: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;
          const distance = calculateDistanceMeters(
            currentLat,
            currentLon,
            newLat,
            newLon
          );

          if (distance > thresholdMeters) {
            resolve({ lat: newLat, lon: newLon });
          } else {
            resolve(null);
          }
        },
        (error) => {
          console.debug('Auto-location update failed:', error);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 30000 }
      );
    });
  }
}
