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

export interface NotificationCooldownRecord {
  docId: string;
  icao: string;
  deviceName?: string;
  lastSent: number;
}

export interface LocationGroup {
  key: string;
  lastSent: number;
  deviceNames: Set<string>;
  location?: {
    lat: number;
    lon: number;
    address?: string;
  };
}