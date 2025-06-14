import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

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
  constructor(private http: HttpClient) {}

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
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;

    return this.http.get<LocationResponse>(url).pipe(
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
}
