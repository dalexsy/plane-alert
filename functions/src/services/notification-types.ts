import type { Location } from '../types';
import type { PushoverMessage } from './pushover-client';

export interface PendingNotification {
  icao: string;
  message: PushoverMessage;
  deviceName: string;
  location: Location;
  callsign?: string;
  model?: string;
  countryCode?: string | null;
  registration?: string;
  lat?: number;
  lon?: number;
  altitude?: number;
  bearing?: number;
  cardinal?: string;
  /** Prefix-military without DB mil — live SPA skips kiosk MP3 for these. */
  playKioskAlert?: boolean;
}

export interface MilitaryCollectionStats {
  militaryCount: number;
  specialCount: number;
  boringCount: number;
  recentlyNotifiedCount: number;
}
