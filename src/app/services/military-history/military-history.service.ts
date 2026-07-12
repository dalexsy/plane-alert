import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  getMilitaryHistoryEndpoint,
  saveMilitarySightingEndpoint,
} from '../../config/firebase.config';

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
  private readonly saveSightingEndpoint = saveMilitarySightingEndpoint;
  private readonly getHistoryEndpoint = getMilitaryHistoryEndpoint;

  constructor(private http: HttpClient) {}

  async getHistory(
    pushoverUserKey: string,
  ): Promise<MilitaryHistorySighting[]> {
    try {
      const response: { history?: MilitaryHistorySighting[] } =
        await firstValueFrom(
          this.http.post(
            this.getHistoryEndpoint,
            { pushoverUserKey },
            { headers: { 'Content-Type': 'application/json' } },
          ),
        );
      return response.history || [];
    } catch (error) {
      console.error('Failed to fetch military history:', error);
      throw error;
    }
  }
}