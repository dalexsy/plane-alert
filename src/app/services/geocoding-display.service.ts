import { Injectable } from '@angular/core';
import { GeocodingCacheService } from './geocoding-cache.service';

@Injectable({
  providedIn: 'root',
})
export class GeocodingDisplayService {
  // Location information for overlays
  public locationStreet: string | null = null;
  public locationDistrict: string | null = null;

  constructor(private geocodingCache: GeocodingCacheService) {}

  /** Reverse geocode coordinates to get address */
  public async reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }

  /** Update location information for display */
  public async updateLocationInfo(lat: number, lon: number): Promise<void> {
    try {
      const address = await this.reverseGeocode(lat, lon);
      if (!address || address.trim() === '') {
        console.log('Empty geocoding result for location update:', address);
      }
      this.locationStreet = address;
      this.locationDistrict = address;
      if (!this.locationDistrict || this.locationDistrict.trim() === '') {
        console.log(
          'locationDistrict is empty after setting (location update):',
          this.locationDistrict
        );
      }
    } catch (error) {
      console.error('Error updating location info:', error);
    }
  }

  /** Resolve address and return coordinates */
  public async resolveAddress(
    address: string
  ): Promise<{ lat: number; lon: number } | null> {
    try {
      const response = await fetch(
        `/nominatim/search?format=json&q=${encodeURIComponent(address)}`,
        {
          headers: { 'User-Agent': 'PlaneAlert/1.0' },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error('Address resolution failed:', error);
      return null;
    }
  }

  /** Clear location information */
  public clearLocationInfo(): void {
    this.locationStreet = null;
    this.locationDistrict = null;
  }
}
