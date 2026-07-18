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
  /** Play local PipeWire MP3 on magicmirror after Pushover delivery. */
  playKioskAlert?: boolean;
}

export interface MilitaryCollectionStats {
  militaryCount: number;
  specialCount: number;
  boringCount: number;
  recentlyNotifiedCount: number;
}
