import * as L from 'leaflet';
import { Plane } from '../types/plane';
import { removeLeftMarkerFromPlane } from '../utils/plane-marker';

// Position history entry with timestamp
export interface PositionHistory {
  lat: number;
  lon: number;
  timestamp: number;
  track?: number | null;
  velocity?: number | null;
  altitude?: number | null;
}

export class PlaneModel implements Plane {
  callsign!: string;
  origin!: string;
  firstSeen!: number;
  model!: string;
  operator!: string;
  bearing!: number;
  cardinal!: string;
  arrow!: string;
  icao!: string;
  isNew!: boolean;
  lat!: number;
  lon!: number;
  track?: number | null;
  velocity?: number | null;
  marker?: L.Marker;
  path?: L.Polyline;
  predictedPathArrowhead?: L.Marker; // Add arrowhead marker property
  filteredOut!: boolean;
  onGround?: boolean;
  isSpecial?: boolean;
  isStale?: boolean;
  isA380?: boolean;
  isMilitary?: boolean;
  isUnknown?: boolean;
  categoryCode?: string; // ADS-B category like 'A5', 'B6', 'C3'
  icaoType?: string; // ICAO aircraft type designator (e.g., 'B738')
  typeDescription?: string; // Text description provided by data source
  /** Distance from home in km, for closest-plane overlay */
  distanceKm?: number;
  // Flight route information from OpenSky Network
  routeOrigin?: string; // ICAO airport code of origin
  routeDestination?: string; // ICAO airport code of destination
  routeOriginIata?: string; // IATA code of origin (when available)
  routeDestinationIata?: string; // IATA code of destination (when available)
  routeOriginName?: string; // Airport name of origin (when available)
  routeDestinationName?: string; // Airport name of destination (when available)
  routeEtaUtc?: string; // ETA in UTC like "12:34Z" (when available)
  routeStatus?: string; // Flight status from FlightAware AeroAPI (when available)
  routeArrivalDelay?: number; // Arrival delay from FlightAware AeroAPI (seconds, when available)
  routeCancelled?: boolean; // Cancelled flag from FlightAware AeroAPI
  routeDiverted?: boolean; // Diverted flag from FlightAware AeroAPI
  airportName?: string; // Optional airport name assigned in MapComponent
  airportCode?: string; // Optional short code (IATA) for airport
  airportLat?: number; // Latitude of center of airport circle assigned when plane is at airport
  airportLon?: number; // Longitude of center of airport circle assigned when plane is at airport
  altitude?: number | null; // Current altitude in meters
  verticalRate?: number | null; // Vertical rate in m/s (positive = ascending, negative = descending)
  // Store position history for path prediction (limited to last 5 positions)
  positionHistory: PositionHistory[] = [];
  // Change historyTrail to store segments
  historyTrailSegments?: L.Polyline[];

  // Maximum number of historical positions to keep
  private readonly MAX_HISTORY_SIZE = 15;

  // No throttling - backend already controls update frequency (every 60 seconds)
  // This just tracks the last capture time for potential future use
  private lastPositionCaptureTime: number = 0;

  constructor(data: Plane) {
    Object.assign(this, data);
    this.historyTrailSegments = []; // Initialize as empty array
    this.predictedPathArrowhead = undefined; // Initialize arrowhead

    // Initialize position history if we have coordinates
    if (data.lat !== undefined && data.lon !== undefined) {
      this.addPositionToHistory(data.lat, data.lon, data.track, data.velocity); // Pass track/velocity
    }
  }

  updateFrom(newData: Plane): void {
    // Store old position before updating
    const oldLat = this.lat;
    const oldLon = this.lon;
    const hasValidOldPosition = oldLat !== undefined && oldLon !== undefined;

    // Update all properties
    Object.assign(this, newData);

    // Add new position to history if coordinates exist and have changed
    // Note: This logic is now handled by the explicit call in findPlanes
    // We keep addPositionToHistory method but don't call it automatically from here.

    this.isNew = Date.now() - this.firstSeen < 60 * 1000;
  }
  // Make public so it can be called by PlaneFinderService
  public addPositionToHistory(
    lat: number,
    lon: number,
    track?: number | null,
    velocity?: number | null,
    altitude?: number | null,
    timestamp?: number
  ): void {
    const entryTimestamp =
      typeof timestamp === 'number' && !Number.isNaN(timestamp)
        ? timestamp
        : Date.now();

    // Always add position - backend controls update frequency
    this.positionHistory.push({
      lat,
      lon,
      timestamp: entryTimestamp,
      track,
      velocity,
      altitude,
    });

    // Update the last capture time for tracking
    this.lastPositionCaptureTime = entryTimestamp;

    // Limit the history size (trim oldest entries beyond cap)
    while (this.positionHistory.length > this.MAX_HISTORY_SIZE) {
      this.positionHistory.shift();
    }
  }

  // Helper to remove trail segments from map
  public removeHistoryTrailSegments(map: L.Map): void {
    if (this.historyTrailSegments) {
      this.historyTrailSegments.forEach((segment) => map.removeLayer(segment));
      this.historyTrailSegments = []; // Clear the array
    }
  } // Helper method to remove all visual elements from the map
  public removeVisuals(map: L.Map): void {
    // Remove left marker if it exists
    if (this.marker) {
      removeLeftMarkerFromPlane(this.marker, map);
    }

    this.marker?.remove();
    this.path?.remove();
    this.predictedPathArrowhead?.remove();
    this.removeHistoryTrailSegments(map);
    // Optionally clear references, though they'll be overwritten/removed elsewhere
    // this.marker = undefined;
    // this.path = undefined;
    // this.predictedPathArrowhead = undefined;
  }
}
