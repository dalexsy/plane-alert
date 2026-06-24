export interface AircraftRecord {
  icao: string;
  reg: string;
  icaotype: string;
  year: string;
  manufacturer: string;
  model: string;
  ownop: string;
  faa_pia: boolean;
  faa_ladd: boolean;
  short_type: string;
  mil: boolean;
}

export const USER_DB_KEY = 'plane-alert-user-aircraft-db';
export const MIN_WRITE_INTERVAL = 60000;
