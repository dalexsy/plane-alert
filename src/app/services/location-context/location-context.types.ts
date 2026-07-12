export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName?: string;
  addressDetails?: Record<string, string>;
}

export interface LocationData {
  address: string;
  lat?: number;
  lon?: number;
  source: 'map' | 'home' | 'default' | 'address' | 'current';
  timestamp: number;
}

export interface TimezoneData {
  timezone: string;
  utcOffset: number;
  dst: boolean;
}

export interface LocationContextInfo {
  location: LocationData;
  timezone?: TimezoneData;
  address?: string;
}
