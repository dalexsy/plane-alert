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
    const url = `/nominatim/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;

    return this.http.get<LocationResponse>(url).pipe(
      timeout(5000),
      map((response) => {
        const street = response.address.road || null;
        const district =
          response.address.suburb ||
          response.address.city_district ||
          response.address.town ||
          response.address.village ||
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
