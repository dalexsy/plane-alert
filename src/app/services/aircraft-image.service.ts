import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap, shareReplay } from 'rxjs/operators';

export interface AircraftImage {
  url: string;
  thumbnail: string;
  description: string;
  source: string;
}

@Injectable({
  providedIn: 'root',
})
export class AircraftImageService {
  private cache = new Map<string, Observable<AircraftImage | null>>();

  constructor(private http: HttpClient) {}

  /**
   * Get aircraft image for a given registration or hex using Planespotters.net API
   */
  getAircraftImage(
    registration?: string,
    hex?: string
  ): Observable<AircraftImage | null> {
    console.log('getAircraftImage called with', { registration, hex });
    if (
      (!registration || registration.trim() === '') &&
      (!hex || hex.trim() === '')
    ) {
      console.log('No valid registration or hex provided');
      return of(null);
    }

    // Create cache key
    const cacheKey = registration ? `reg:${registration}` : `hex:${hex}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const request = this.fetchFromPlanespotters(registration, hex).pipe(
      shareReplay(1)
    );

    // Cache the observable
    this.cache.set(cacheKey, request);
    return request;
  }

  /**
   * Fetch image from Planespotters.net API
   */
  private fetchFromPlanespotters(
    registration?: string,
    hex?: string
  ): Observable<AircraftImage | null> {
    // Try registration first, then hex
    const identifiers = [
      { type: 'reg', value: registration },
      { type: 'hex', value: hex },
    ].filter((id) => id.value && id.value.trim());

    if (identifiers.length === 0) {
      return of(null);
    }

    // Try each identifier in order
    let currentRequest: Observable<AircraftImage | null> = of(null);

    for (const { type, value } of identifiers) {
      currentRequest = currentRequest.pipe(
        switchMap((result) => {
          if (result) {
            return of(result); // Already have a result
          }

          const url = `https://api.planespotters.net/pub/photos/${type}/${encodeURIComponent(
            value!.trim()
          )}`;

          return this.http.get<any>(url).pipe(
            map((data) => {
              console.log('Planespotters API response for', value, ':', data);
              if (data.photos && data.photos.length > 0) {
                const photo = data.photos[0];
                // Extract URL from thumbnail_large, thumbnail, or photo objects
                let imageUrl = null;
                if (
                  photo.thumbnail_large &&
                  typeof photo.thumbnail_large === 'object' &&
                  photo.thumbnail_large.src
                ) {
                  imageUrl = photo.thumbnail_large.src;
                } else if (
                  photo.thumbnail &&
                  typeof photo.thumbnail === 'object' &&
                  photo.thumbnail.src
                ) {
                  imageUrl = photo.thumbnail.src;
                } else if (photo.photo && typeof photo.photo === 'string') {
                  imageUrl = photo.photo;
                }
                if (imageUrl) {
                  return {
                    url: imageUrl,
                    thumbnail:
                      photo.thumbnail &&
                      typeof photo.thumbnail === 'object' &&
                      photo.thumbnail.src
                        ? photo.thumbnail.src
                        : imageUrl,
                    description: photo.photographer
                      ? `Photo by ${photo.photographer}`
                      : 'Aircraft photo from Planespotters.net',
                    source: 'Planespotters.net',
                  };
                }
              }
              return null;
            }),
            catchError((error) => {
              console.error('Planespotters API error for', value, ':', error);
              return of(null);
            })
          );
        })
      );
    }

    return currentRequest;
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
