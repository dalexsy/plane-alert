import { NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { buildAddressString, ReverseGeocodeResponse } from './geocoding-address.util';

function coordFallback(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/**
 * Reverse geocode via Pi planes-api (same-origin /api/planes/*).
 * Do not call /nominatim from the browser — production has no working proxy (504).
 * Failures return coordinates silently (no console.error — that used to spam deploy noise).
 */
export async function performGeocodeRequest(
  http: HttpClient,
  ngZone: NgZone,
  lat: number,
  lon: number,
  retryCount = 0
): Promise<string> {
  const maxRetries = 1;
  try {
    const apiUrl = `/api/planes/reverseGeocode?lat=${lat}&lon=${lon}`;
    const apiBody = await ngZone.runOutsideAngular(() =>
      firstValueFrom(
        http.get<{ ok?: boolean; address?: string }>(apiUrl).pipe(timeout(8000))
      )
    );
    const fromApi = String(apiBody?.address ?? '').trim();
    if (fromApi) return fromApi;

    // Secondary: client-side bigdatacloud (no key) when Pi cannot reach Nominatim
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const response = await ngZone.runOutsideAngular(() =>
      firstValueFrom(http.get<ReverseGeocodeResponse>(url).pipe(timeout(5000)))
    );
    const formatted = buildAddressString(response);
    if (formatted) return formatted;
    return (
      response.locality ||
      response.city ||
      response.principalSubdivision ||
      coordFallback(lat, lon)
    );
  } catch (error: any) {
    const retryable =
      retryCount < maxRetries &&
      (error?.message?.includes('Http failure response') ||
        error?.message?.includes('TimeoutError') ||
        error?.name === 'TimeoutError' ||
        error?.status === 0 ||
        error?.status === 502 ||
        error?.status === 503 ||
        error?.status === 504);
    if (retryable) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (retryCount + 1)));
      return performGeocodeRequest(http, ngZone, lat, lon, retryCount + 1);
    }
    // Expected network/gateway failures: coordinate string only — never console.error
    return coordFallback(lat, lon);
  }
}
