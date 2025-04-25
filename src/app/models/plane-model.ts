import * as L from 'leaflet';
import { Plane } from '../types/plane';

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
  marker?: L.Marker;
  path?: L.Polyline;
  predictedPathArrowhead?: L.Marker; // Add arrowhead marker property
  filteredOut!: boolean;
  onGround?: boolean;
  isSpecial?: boolean;
  isMilitary?: boolean;
  airportName?: string; // Optional airport name assigned in MapComponent
  airportCode?: string; // Optional short code (IATA) for airport

  // Store position history for path prediction (limited to last 5 positions)
  positionHistory: PositionHistory[] = [];
  // Change historyTrail to store segments
  historyTrailSegments?: L.Polyline[];

  // Maximum number of historical positions to keep
  private readonly MAX_HISTORY_SIZE = 15;

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
    // Log adding position
    // console.log(`[PlaneModel ${this.icao}] Adding position: lat=${lat}, lon=${lon}, track=${track}, velocity=${velocity}`);
    this.positionHistory.push({
      lat,
      lon,
      timestamp: Date.now(),
      track,
      velocity,
      altitude,
    });

    // Limit the history size
    if (this.positionHistory.length > this.MAX_HISTORY_SIZE) {
      this.positionHistory.shift(); // Remove oldest entry
    }
    // Log current history size
    // console.log(`[PlaneModel ${this.icao}] History size: ${this.positionHistory.length}`);
  }

  // Helper to remove trail segments from map
  public removeHistoryTrailSegments(map: L.Map): void {
    if (this.historyTrailSegments) {
      this.historyTrailSegments.forEach((segment) => map.removeLayer(segment));
      this.historyTrailSegments = []; // Clear the array
      // console.log(`[PlaneModel ${this.icao}] Removed history trail segments.`);
    }
  }

  // Helper method to remove all visual elements from the map
  public removeVisuals(map: L.Map): void {
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
