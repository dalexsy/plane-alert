import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MilitaryHistorySighting {
  icao: string;
  callsign?: string;
  model?: string;
  operator?: string;
  country?: string;
  registration?: string;
  notificationDelivered?: boolean;
  notifiedDeviceName?: string;
  notifiedDeviceCount?: number;
  notifiedDeviceNames?: string[];
  notificationLocation?: {
    lat: number;
    lon: number;
    address?: string;
  };
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
    environment.endpoints.saveMilitarySighting;
  private readonly getHistoryEndpoint =
    environment.endpoints.getMilitaryHistory;

  constructor(private http: HttpClient) {}

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
