import { NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { buildAddressString, ReverseGeocodeResponse } from './geocoding-address.util';

export async function performGeocodeRequest(
  http: HttpClient,
  ngZone: NgZone,
  lat: number,
  lon: number,
  retryCount = 0
): Promise<string> {
  const maxRetries = 2;
  try {
    const nominatimUrl = `/nominatim/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`;
    const nominatimResponse = await ngZone.runOutsideAngular(() =>
      firstValueFrom(http.get<any>(nominatimUrl).pipe(timeout(5000)))
    );
    if (nominatimResponse?.address) {
      const addr = nominatimResponse.address;
      const parts: string[] = [];
      const district = addr.suburb || addr.city_district || addr.neighbourhood;
      if (district) parts.push(district);
      const city = addr.city || addr.town || addr.village;
      if (city && city !== district) parts.push(city);
      if (addr.state && addr.state !== city) parts.push(addr.state);
      if (parts.length > 0) return parts.join(', ');
    }
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const response = await ngZone.runOutsideAngular(() =>
      firstValueFrom(http.get<ReverseGeocodeResponse>(url).pipe(timeout(5000)))
    );
    const formatted = buildAddressString(response);
    if (formatted) return formatted;
    return response.locality || response.city || response.principalSubdivision || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error: any) {
    if (
      retryCount < maxRetries &&
      (error.message?.includes('Http failure response') ||
        error.message?.includes('TimeoutError') ||
        error.name === 'TimeoutError' ||
        error.status === 0)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return performGeocodeRequest(http, ngZone, lat, lon, retryCount + 1);
    }
    if (error.status === 403) console.warn('Geocoding rate limited (403). Caching will reduce future requests.');
    else console.warn('Geocoding failed:', error);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
