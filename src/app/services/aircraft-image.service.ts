import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

export interface AircraftImage {
  url: string;
  thumbnail: string;
  description: string;
  source: string;
}

interface GoogleCustomSearchResponse {
  items?: Array<{
    title: string;
    link: string;
    snippet: string;
    pagemap?: {
      cse_image?: Array<{ src: string }>;
      cse_thumbnail?: Array<{ src: string; width: string; height: string }>;
    };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class AircraftImageService {
  private readonly GOOGLE_API_KEY = 'AIzaSyCzYNT3V-CNUauNPwSe15KAKtDAUWms77Q'; // Your API key
  private readonly GOOGLE_SEARCH_ENGINE_ID = '5578bd93246c848a4'; // Your search engine ID
  private readonly GOOGLE_ENDPOINT =
    'https://www.googleapis.com/customsearch/v1';
  private cache = new Map<string, Observable<AircraftImage | null>>();

  constructor(private http: HttpClient) {}

  /**
   * Get aircraft image for a given model using Google Custom Search API
   */
  getAircraftImage(
    model: string,
    operator?: string
  ): Observable<AircraftImage | null> {
    if (!model || model.trim() === '') {
      return of(null);
    }

    // Create cache key that includes operator if available
    const cacheKey = operator ? `${model}|${operator}` : model;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Try primary search (aviation sites) first
    const primaryRequest = this.searchWithQuery(model, operator, true);

    // Fallback to broader search if primary fails
    const fallbackRequest = this.searchWithQuery(model, operator, false);

    const request = primaryRequest.pipe(
      switchMap((result) => {
        if (result) {
          return of(result);
        } else {
          // Primary search failed, try fallback
          return fallbackRequest;
        }
      })
    );

    // Cache the observable
    this.cache.set(cacheKey, request);
    return request;
  }

  /**
   * Perform search with specific query configuration
   */
  private searchWithQuery(
    model: string,
    operator: string | undefined,
    useAviationSites: boolean
  ): Observable<AircraftImage | null> {
    // Create specific search query for aircraft model
    let searchQuery = `"${model}" aircraft airplane photo`;
    if (operator && operator.trim()) {
      // Add operator to search for more specific results
      const operatorShort = operator.split(' ')[0]; // Take first word (e.g., "Swiss" from "Swiss International Air Lines")
      searchQuery += ` "${operatorShort}"`;
    }

    if (useAviationSites) {
      // Prioritize aviation photography sites
      searchQuery +=
        ' site:planespotters.net OR site:airliners.net OR site:jetphotos.com';
    }

    searchQuery +=
      ' -cartoon -drawing -model -toy -lego -illustration -diagram -youtube -thumbnail';

    const params = new HttpParams()
      .set('key', this.GOOGLE_API_KEY)
      .set('cx', this.GOOGLE_SEARCH_ENGINE_ID)
      .set('q', searchQuery)
      .set('searchType', 'image')
      .set('num', '1')
      .set('imgSize', 'large')
      .set('imgType', 'photo')
      .set('safe', 'active');

    return this.http
      .get<GoogleCustomSearchResponse>(this.GOOGLE_ENDPOINT, { params })
      .pipe(
        map((response) => {
          if (response.items && response.items.length > 0) {
            const item = response.items[0];
            const imageUrl = item.link;

            // Check if the image URL is from a problematic domain
            if (this.isProblematicDomain(imageUrl)) {
              return null; // Skip this result
            }

            const thumbnailUrl =
              item.pagemap?.cse_thumbnail?.[0]?.src || imageUrl;

            return {
              url: imageUrl,
              thumbnail: thumbnailUrl,
              description: item.snippet || item.title || '',
              source: 'Google Images',
            };
          }
          return null;
        }),
        catchError((error) => {
          // Only log actual API errors, not 404s or quota exceeded
          if (error.status !== 404 && error.status !== 429) {
            console.warn('Google Custom Search API error:', error);
          }
          return of(null);
        })
      );
  }

  /**
   * Check if domain is known to cause CORS or 406 errors
   */
  private isProblematicDomain(url: string): boolean {
    const problematicDomains = [
      'usatoday.com',
      'gcdn.media',
      'media.gcdn',
      'todayinthesky',
      'wikipedia.org', // Often has CORS issues
      'wikimedia.org',
      'flickr.com', // Sometimes blocks hotlinking
      'instagram.com', // Always blocks
      'facebook.com',
      'twitter.com',
      'x.com',
      'pinterest.com',
    ];

    try {
      const urlObj = new URL(url);
      return problematicDomains.some((domain) =>
        urlObj.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
