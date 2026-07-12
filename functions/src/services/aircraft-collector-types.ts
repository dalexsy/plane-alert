export const AIRCRAFT_SNAPSHOTS_COLLECTION = 'aircraft-snapshots';
export const DEFAULT_RADIUS_KM = 100;
export const MIN_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 200;

export interface HomeLocation {
  lat: number;
  lon: number;
}

export interface DeviceRegistration {
  pushoverUserKey: string;
  home?: HomeLocation;
  radiusKm?: number;
  notifyProximity?: boolean;
  ignoredTypes?: string[];
  specialIcaos?: string[];
  deviceName?: string;
  deviceSlug?: string;
  lastNotified?: Record<string, number>;
  lastProximityNotified?: Record<string, number>;
}

export interface LocationGroup {
  lat: number;
  lon: number;
  radiusKm: number;
  devices: string[];
}
