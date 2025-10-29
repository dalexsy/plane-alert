import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, timeout } from 'rxjs';
import { GeocodingCacheService } from './geocoding-cache.service';

interface LocationResponse {
  address: {
    road?: string;
    suburb?: string;
    city_district?: string;
    town?: string;
    village?: string;
  };
}

export interface GeocodeResult {
  lat: number;
  lon: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor(
    private http: HttpClient,
    private geocodingCache: GeocodingCacheService
  ) {}

  /**
   * Get street and district information based on latitude and longitude
   * @param lat Latitude
   * @param lng Longitude
   * @returns Observable with street and district information
   */
  getLocationInfo(
    lat: number,
    lng: number
  ): Observable<{ street: string | null; district: string | null }> {
    // Using Nominatim API for reverse geocoding
    const url = `/nominatim/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;

    return this.http.get<LocationResponse>(url).pipe(
      timeout(5000), // 5 second timeout
      map((response) => {
        const street = response.address.road || null;
        // Try to get district from different possible fields
        const district =
          response.address.suburb ||
          response.address.city_district ||
          response.address.town ||
          response.address.village ||
          null;

        return { street, district };
      }),
      catchError(() => {
        // Return empty values if the API call fails
        return of({ street: null, district: null });
      })
    );
  }

  /**
   * Reverse geocode coordinates to get address string
   */
  reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }

  /**
   * Forward geocode an address string to coordinates
   */
  forwardGeocode(address: string): Promise<GeocodeResult | null> {
    return new Promise((resolve) => {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      fetch(
        `/nominatim/search?format=json&q=${encodeURIComponent(
          address
        )}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'PlaneAlert/1.0' },
        }
      )
        .then((res) => {
          clearTimeout(timeoutId);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.length) {
            resolve({
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon),
            });
          } else {
            console.warn('No results found for address:', address);
            resolve(null);
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          // Specific handling for CORS/network errors
          if (
            error instanceof TypeError &&
            error.message.includes('Failed to fetch')
          ) {
            console.warn(
              'Address search blocked by CORS policy or network error:',
              address
            );
          } else if (error.name === 'AbortError') {
            console.warn('Address search timed out:', address);
          } else {
            console.warn('Address search failed:', error);
          }
          resolve(null);
        });
    });
  }

  /**
   * Get current location using geolocation API
   */
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

  /**
   * Check and update location automatically if setting is enabled
   */
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

          // Calculate distance to check if location has changed significantly
          const distance = this.calculateDistance(
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

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
