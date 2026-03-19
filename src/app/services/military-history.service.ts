import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface MilitaryHistorySighting {
  icao: string;
  callsign?: string;
  model?: string;
  operator?: string;
  country?: string;
  registration?: string;
  firstSeen: number;
  lastSeen: number;
  sightingCount: number;
  lat?: number;
  lon?: number;
  altitude?: number;
  bearing?: number;
  cardinal?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MilitaryHistoryService {
  private readonly saveSightingEndpoint =
    'https://savemilitarysighting-wmktwp72xq-uc.a.run.app';
  private readonly getHistoryEndpoint =
    'https://getmilitaryhistory-wmktwp72xq-uc.a.run.app';

  constructor(private http: HttpClient) {}

  /**
   * Save a military plane sighting
   */
  async saveSighting(
    pushoverUserKey: string,
    plane: {
      icao: string;
      callsign?: string;
      model?: string;
      operator?: string;
      country?: string;
      registration?: string;
      lat?: number;
      lon?: number;
      altitude?: number;
      bearing?: number;
      cardinal?: string;
    },
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(
          this.saveSightingEndpoint,
          {
            pushoverUserKey,
            ...plane,
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      return true;
    } catch (error) {
      console.error('Failed to save military sighting:', error);
      return false;
    }
  }

  /**
   * Get all military sightings for a pushover key
   */
  async getHistory(
    pushoverUserKey: string,
  ): Promise<MilitaryHistorySighting[]> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(
          this.getHistoryEndpoint,
          { pushoverUserKey },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      return response.history || [];
    } catch (error) {
      console.error('Failed to fetch military history:', error);
      return [];
    }
  }
}
