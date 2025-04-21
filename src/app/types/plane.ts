// src/app/types/plane.ts
import * as L from 'leaflet';

export interface Plane {
  callsign: string;
  origin: string;
  firstSeen: number;
  model: string;
  operator: string;
  bearing: number;
  cardinal: string;
  arrow: string;
  icao: string;
  isNew: boolean;
  lat?: number;
  lon?: number;
  marker?: L.Marker;
  path?: L.Polyline;
  filteredOut?: boolean;
  onGround?: boolean;
  track?: number | null;
  velocity?: number | null;
}
