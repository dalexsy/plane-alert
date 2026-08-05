export interface PlaneLogEntry {
  callsign: string;
  origin: string;
  firstSeen: number;
  model?: string;
  operator?: string;
  bearing?: number;
  cardinal?: string;
  arrow?: string;
  isNew?: boolean;
  lat?: number;
  lon?: number;
  filteredOut?: boolean;
  icao: string;
  isMilitary?: boolean;
  /** False when military but not alert-worthy (muted green on kiosk). */
  isMilitaryAlertWorthy?: boolean;
  isSpecial?: boolean;
  isA380?: boolean;
  isUnknown?: boolean;
  onGround?: boolean;
  airportName?: string;
  airportCode?: string;
  airportLat?: number;
  airportLon?: number;
  altitude?: number | null;
}
