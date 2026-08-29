// src/app/types/plane.ts
import * as L from 'leaflet';

export interface Plane {
  callsign: string;
  origin: string;
  firstSeen: number;
  model: string;
  /** ADS-B ICAO type designator (`ac.t`), e.g. C30J. */
  icaoType?: string;
  /** ADS-B emitter category (`ac.category`), e.g. B2 lighter-than-air. */
  category?: string;
  operator: string;
  bearing: number;
  cardinal: string;
  arrow: string;
  icao: string;
  isNew: boolean;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  marker?: L.Marker;
  path?: L.Polyline;
  filteredOut?: boolean;
  onGround?: boolean;
  track?: number | null;
  velocity?: number | null;
  /** Indicates special plane category */
  isSpecial?: boolean;
  /** Indicates if this is an A380 for visual highlighting */
  isA380?: boolean;
}
