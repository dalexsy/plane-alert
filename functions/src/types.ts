export interface Location {
  lat: number;
  lon: number;
  address?: string;
}

export interface DeviceRegistration {
  pushoverUserKey: string;
  platform?: string;
  distanceUnit?: 'km' | 'miles';
  radiusKm?: number;
  timezone?: string;
  location?: Location;
  specialIcaos?: string[]; // Array of ICAO codes user wants to be notified about
  ignoredTypes?: string[]; // Array of aircraft type codes to ignore (e.g., ['C130', 'A400'])
  notifyProximity?: boolean; // Notify for ANY plane within 2km
  lastNotified?: Record<string, number>;
  lastProximityNotified?: Record<string, number>; // Track proximity notifications separately
  deviceName?: string;
  deviceSlug?: string;
  createdAt?: any;
  updatedAt?: any;
}
