import * as L from 'leaflet';
import { Plane } from '../types/plane';
import { removeLeftMarkerFromPlane } from '../utils/plane-marker/plane-marker';

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
  /** ADS-B ICAO type designator (`ac.t`), e.g. C30J. */
  icaoType?: string;
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
  isA380?: boolean;
  isMilitary?: boolean;
  /** False when mil but boring (trainers, model-less rescue helis, …). */
  isMilitaryAlertWorthy?: boolean;
  isUnknown?: boolean;
  /** Distance from home in km, for closest-plane overlay */
  distanceKm?: number;
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

  // Throttling for position history capture (20 seconds minimum interval)
  private readonly POSITION_HISTORY_THROTTLE_MS = 20000;
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
    altitude?: number | null
  ): void {
    const currentTime = Date.now();

    const last = this.positionHistory[this.positionHistory.length - 1];
    const movedSinceLast =
      !last ||
      Math.abs(last.lat - lat) > 0.00005 ||
      Math.abs(last.lon - lon) > 0.00005 ||
      Math.abs((last.altitude ?? 0) - (altitude ?? 0)) > 25;

    // Capture on each scan movement, not only when the throttle window elapses.
    if (
      this.lastPositionCaptureTime === 0 ||
      movedSinceLast ||
      currentTime - this.lastPositionCaptureTime >=
        this.POSITION_HISTORY_THROTTLE_MS
    ) {
      // Log adding position
      this.positionHistory.push({
        lat,
        lon,
        timestamp: currentTime,
        track,
        velocity,
        altitude,
      });

      // Update the last capture time
      this.lastPositionCaptureTime = currentTime;

      // Limit the history size
      if (this.positionHistory.length > this.MAX_HISTORY_SIZE) {
        this.positionHistory.shift(); // Remove oldest entry
      }
    }
    // If throttled, the position update is simply ignored for history purposes
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
    // Historical planes stay in memory for the "All Planes Peeped" list.
    // Never let that data history retain detached Leaflet DOM trees.
    this.marker = undefined;
    this.path = undefined;
    this.predictedPathArrowhead = undefined;
  }
}
