import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

export interface FlightRoute {
  origin?: string; // ICAO airport code
  destination?: string; // ICAO airport code
  departureTime?: number; // Unix timestamp
  arrivalTime?: number; // Unix timestamp
}

@Injectable({
  providedIn: 'root',
})
export class OpenskyRouteService {
  // Use Firebase Cloud Function proxy to bypass CORS
  private readonly PROXY_URL = 'https://us-central1-plane-alert-800ff.cloudfunctions.net/openskyProxy';
  private readonly CACHE_DURATION_MS = 3600000; // 1 hour
  private readonly CACHE_PREFIX = 'opensky_route_';
  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

  // Rate limiting
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests

  // Disable OpenSky route fetching due to severe rate limits (100 req/day)
  // The data was also limited - only shows routes after aircraft lands
  private readonly ENABLED = false;

  constructor(private http: HttpClient) {}

  /**
   * Get flight route (origin/destination) for an aircraft by ICAO hex
   * Results are cached for 1 hour to avoid rate limits
   * 
   * NOTE: Currently disabled due to OpenSky rate limits. Returns null immediately.
   */
  getFlightRoute(icao: string): Observable<FlightRoute | null> {
    // Early exit if disabled
    if (!this.ENABLED) {
      return of(null);
    }

    const icaoLower = icao.toLowerCase();

    // Check cache first
    const cached = this.getCachedRoute(icaoLower);
    if (cached !== null) {
      return of(cached);
    }

    // Rate limiting - don't make requests too frequently
    const now = Date.now();
    if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL_MS) {
      // Return null instead of waiting to avoid blocking
      return of(null);
    }

    this.lastRequestTime = now;

    // Use Firebase proxy endpoint
    const url = `${this.PROXY_URL}?icao24=${icaoLower}`;

    return this.http.get<{
      origin: string | null;
      destination: string | null;
      departureTime?: number;
      arrivalTime?: number;
    }>(url).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((response) => {
        if (!response || (!response.origin && !response.destination)) {
          // Cache the null result to avoid repeated failed queries
          this.cacheRoute(icaoLower, null);
          return null;
        }

        const route: FlightRoute = {
          origin: response.origin || undefined,
          destination: response.destination || undefined,
          departureTime: response.departureTime,
          arrivalTime: response.arrivalTime,
        };

        // Only cache if we have useful data
        if (route.origin || route.destination) {
          this.cacheRoute(icaoLower, route);
          return route;
        }

        // Cache null result
        this.cacheRoute(icaoLower, null);
        return null;
      }),
      catchError((error) => {
        // Don't throw errors, just return null
        console.warn(`OpenSky route fetch failed for ${icao}:`, error.message);
        // Cache null to avoid repeated failures
        this.cacheRoute(icaoLower, null);
        return of(null);
      })
    );
  }

  /**
   * Get cached route data from localStorage
   */
  private getCachedRoute(icao: string): FlightRoute | null {
    try {
      const cacheKey = this.CACHE_PREFIX + icao;
      const cached = localStorage.getItem(cacheKey);

      if (!cached) {
        return null;
      }

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > this.CACHE_DURATION_MS) {
        // Cache expired
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cache route data in localStorage
   */
  private cacheRoute(icao: string, route: FlightRoute | null): void {
    try {
      const cacheKey = this.CACHE_PREFIX + icao;
      const cacheData = {
        data: route,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      // localStorage might be full or disabled, ignore
      console.warn('Failed to cache route data:', e);
    }
  }

  /**
   * Clear all cached route data
   */
  clearCache(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Failed to clear route cache:', e);
    }
  }
}
