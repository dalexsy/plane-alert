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
  track?: number | null;
  velocity?: number | null;
  marker?: L.Marker;
  path?: L.Polyline;
  predictedPathArrowhead?: L.Marker; // Add arrowhead marker property
  filteredOut!: boolean;
  onGround?: boolean;
  isSpecial?: boolean;
  isMilitary?: boolean;
  airportName?: string; // Optional airport name assigned in MapComponent
  airportCode?: string; // Optional short code (IATA) for airport
  category?: string; // Add optional category property

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
  }

  // Helper to remove trail segments from map
  public removeHistoryTrailSegments(map: L.Map): void {
    if (this.historyTrailSegments) {
      this.historyTrailSegments.forEach((segment) => map.removeLayer(segment));
      this.historyTrailSegments = []; // Clear the array
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

  // Update marker scale without recreating the marker
  public refreshMarkerScale(scaleFactor: number): void {
    if (!this.marker) return;

    // Get current marker element
    const markerEl = this.marker.getElement();
    if (!markerEl) return;

    // Calculate new size based on plane status
    const baseSize = this.onGround ? 32 : 48;
    const size = baseSize * scaleFactor;

    // Apply new scale to the marker element
    if (markerEl.querySelector('.plane-marker')) {
      const planeMarker = markerEl.querySelector('.plane-marker');
      if (planeMarker) {
        // Update size if needed
        planeMarker.setAttribute(
          'style',
          `${
            planeMarker.getAttribute('style') || ''
          }; width: ${size}px; height: ${size}px;`
        );
      }
    }

    // Update tooltip positioning if needed
    const tooltip = this.marker.getTooltip();
    if (tooltip) {
      // Adjust tooltip offset based on new size
      const marginPx = 5;
      const offsetX = this.onGround
        ? -(size / 2 + marginPx)
        : size / 2 + marginPx;
      tooltip.options.offset = L.point(offsetX, 0);

      // Force tooltip to update its position
      if (tooltip.isOpen()) {
        tooltip.update();
      }
    }
  }
}
