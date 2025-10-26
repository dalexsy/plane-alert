import { Injectable } from '@angular/core';
import { PlaneModel } from '../models/plane-model';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import { ResultsOverlayComponent } from '../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../components/window-view-overlay/window-view-overlay.component';
import { computeWindowHistoryPositions } from '../utils/window-history-trail-utils';
import { getIconPathForModel } from '../utils/plane-icons';
import { calculateVerticalRateFromHistory } from '../utils/vertical-rate.util';
import { haversineDistance } from '../utils/geo-utils';
import { SettingsService } from './settings.service';
import { HelicopterIdentificationService } from './helicopter-identification.service';

@Injectable({
  providedIn: 'root',
})
export class PlaneLogService {
  private planeLog = new Map<string, PlaneModel>();
  private planeHistoricalLog: PlaneModel[] = [];
  private resultsOverlayComponent!: ResultsOverlayComponent;
  private windowViewOverlayComponent!: WindowViewOverlayComponent;
  private settings: SettingsService;
  private helicopterIdentificationService: HelicopterIdentificationService;

  constructor(
    settings: SettingsService,
    helicopterIdentificationService: HelicopterIdentificationService
  ) {
    this.settings = settings;
    this.helicopterIdentificationService = helicopterIdentificationService;
  }

  /**
   * Initialize the service with component references
   */
  initialize(
    resultsOverlayComponent: ResultsOverlayComponent,
    windowViewOverlayComponent: WindowViewOverlayComponent
  ): void {
    this.resultsOverlayComponent = resultsOverlayComponent;
    this.windowViewOverlayComponent = windowViewOverlayComponent;
  }

  getLog(): Map<string, PlaneModel> {
    return this.planeLog;
  }

  getHistoricalLog(): PlaneModel[] {
    return this.planeHistoricalLog;
  }

  updateLog(updatedPlanes: PlaneModel[]): void {
    this.planeLog.clear();
    for (const plane of updatedPlanes) {
      this.planeLog.set(plane.icao, plane);
    }
  }

  updateHistoricalLog(planes: PlaneModel[]): void {
    this.planeHistoricalLog = planes;
  }

  clearHistoricalLog(): void {
    this.planeHistoricalLog = [];
  }

  /**
   * Update plane logs and UI state
   */
  updatePlaneLog(planes: PlaneModel[]): PlaneModel[] {
    // Assign airport code/name for planes within airport circles
    planes.forEach((p) => {
      p.airportCode = undefined;
      p.airportName = undefined;
      // Note: Airport assignment logic would be handled by AirportService
    });

    // Get current center for distance calculations
    const centerLat = this.settings.lat ?? 52.3667;
    const centerLon = this.settings.lon ?? 13.5033;
    const visiblePlanes = planes.filter(
      (p) => !p.filteredOut && p.lat != null && p.lon != null
    );

    // Sort sky list by firstSeen for display (newest bottom)
    visiblePlanes.sort((a, b) => a.firstSeen - b.firstSeen);
    this.resultsOverlayComponent.skyPlaneLog =
      visiblePlanes as unknown as PlaneLogEntry[];

    // Show planes at airports (those with assigned airportCode)
    const airportPlanes = visiblePlanes.filter((p) => p.airportCode != null);
    this.resultsOverlayComponent.airportPlaneLog =
      airportPlanes as unknown as PlaneLogEntry[];

    // Update the window view overlay with airborne planes
    const windowViewPlanes = this.updateWindowViewPlanes(
      visiblePlanes,
      centerLat,
      centerLon
    );

    // Merge into historical log
    const mergedMap = new Map<string, PlaneModel>();
    // Add existing historical planes first
    for (const plane of this.planeHistoricalLog) {
      mergedMap.set(plane.icao, plane);
    }
    // Add/update with current planes (including their filteredOut status)
    for (const plane of planes) {
      mergedMap.set(plane.icao, plane);
    }
    // Store the full merged list, including filtered items
    const updatedHistoricalLog = Array.from(mergedMap.values());

    // Sort the full historical log chronologically (most recent first)
    updatedHistoricalLog.sort((a, b) => b.firstSeen - a.firstSeen);

    // Build seen list: sort by recency and prioritize military
    const historyFiltered = updatedHistoricalLog
      .filter((p) => !p.filteredOut)
      .sort((a, b) => b.firstSeen - a.firstSeen);
    const militaryPlanes = historyFiltered.filter((p) => p.isMilitary);
    const otherPlanes = historyFiltered.filter((p) => !p.isMilitary);
    this.resultsOverlayComponent.seenPlaneLog = [
      ...militaryPlanes,
      ...otherPlanes,
    ] as unknown as PlaneLogEntry[];

    // Update the service's historical log
    this.planeHistoricalLog = updatedHistoricalLog;

    return updatedHistoricalLog;
  }

  /**
   * Update window view planes with current plane data
   */
  private updateWindowViewPlanes(
    visiblePlanes: PlaneModel[],
    centerLat: number,
    centerLon: number
  ): WindowViewPlane[] {
    const windowViewPlanes = visiblePlanes
      // include grounded planes as well
      .filter((p) => (p.altitude ?? 0) > 0 || p.onGround)
      .map((plane) => {
        const isGrounded = !!plane.onGround;
        // Calculate azimuth (bearing) from homeLocation to plane
        const azimuth = this.calculateAzimuth(
          this.settings.lat ?? 52.3667,
          this.settings.lon ?? 13.5033,
          plane.lat,
          plane.lon
        ); // 0 = North, 90 = East, etc.
        const azimuthFromSouth = (azimuth + 180) % 360;
        const x = (azimuthFromSouth / 360) * 100; // Altitude: map 0-20000m to 0-100% (cap at 20km, consistent with window view visual scale)
        // For grounded planes, use 0 altitude for consistency
        const alt = isGrounded ? 0 : plane.altitude ?? 0;
        const y = (Math.min(alt, 20000) / 20000) * 100;
        const iconData = getIconPathForModel(plane.model, plane.callsign, alt);
        // Calculate scale, distance
        const distKm = haversineDistance(
          centerLat,
          centerLon,
          plane.lat!,
          plane.lon!
        );
        const maxRadius = this.settings.radius ?? 5; // fallback radius in km
        // Mobile-first aircraft scaling: closer planes smaller on mobile, larger on desktop
        let scale = 1.0; // Default scale
        const isMobile = window.innerWidth < 600; // Mobile breakpoint

        if (distKm <= 10) {
          // Within 10km: mobile vs desktop scaling behavior
          const normalizedDistance = distKm / 10; // 0 to 1 within 10km
          const exponentialCurve = Math.pow(normalizedDistance, 1.5); // Smooth exponential falloff

          if (isMobile) {
            // Mobile: closer planes smaller (scale from 0.6 at 0km to 1.0 at 10km)
            scale = Math.max(0.6, 0.6 + exponentialCurve * 0.4); // 0.6 to 1.0 range
          } else {
            // Desktop: closer planes larger (scale from 3.0 at 0km to 1.0 at 10km)
            scale = Math.max(1.0, 3.0 - exponentialCurve * 2.0); // 3.0 to 1.0 range
          }
        } else {
          // Beyond 10km: gradual scaling from 1.0 to 0.5 based on max radius
          const beyondNormalized = Math.min(
            (distKm - 10) / (maxRadius - 10),
            1
          );
          scale = Math.max(0.5, 1.0 - beyondNormalized * 0.5); // 1.0 to 0.5 range
        }
        // Compute history positions for window view
        const rawHistory = computeWindowHistoryPositions(
          plane.positionHistory,
          centerLat,
          centerLon
        );
        const historyTrail = rawHistory.map(
          (hp: any, idx: number, arr: any[]) => ({
            x: hp.x,
            y: hp.y,
            opacity: 0.1 + (0.9 * idx) / (arr.length - 1 || 1),
          })
        );
        return {
          x,
          y,
          callsign: plane.callsign || '',
          altitude: alt,
          lat: plane.lat!,
          lon: plane.lon!,
          bearing: plane.track ?? 0,
          iconPath: iconData.path,
          iconType: iconData.iconType,
          isHelicopter: this.helicopterIdentificationService.isHelicopter(
            plane.icao,
            plane.model
          ),
          velocity: plane.velocity ?? 0,
          verticalRate:
            plane.verticalRate ??
            calculateVerticalRateFromHistory(plane.positionHistory) ??
            undefined,
          // historical trail for window view
          historyTrail,
          scale,
          distanceKm: distKm,
          isNew: plane.isNew,
          isMilitary: plane.isMilitary,
          isSpecial: plane.isSpecial,
          icao: plane.icao, // for type safety
          origin: plane.origin, // Origin country for flag display
          isGrounded,
          operator: plane.operator, // Add operator for display
          model: plane.model, // Add model for display
        };
      });

    // Add window view markers for cone boundaries and midpoints
    this.updateWindowViewMarkers(windowViewPlanes);

    return windowViewPlanes;
  }

  /**
   * Add window view markers for cone boundaries and midpoints
   */
  private updateWindowViewMarkers(windowViewPlanes: WindowViewPlane[]): void {
    // Define the azimuth ranges directly matching ConeComponent angles
    const cones = [
      { label: 'Balcony', start: 75, end: 190 }, // ENE to S
      { label: 'Streetside', start: 245, end: 345 }, // SW to N
    ];
    // Use a fixed radius for window view markers (e.g., 10km)
    const markerRadiusKm = 10;
    // Get home location as the anchor
    const home = this.settings.getHomeLocation();
    if (!home) return;
    const lat = home.lat;
    const lon = home.lon;
    // Helper to convert azimuth (deg, 0=N) to window view x (0-100, 0=left, 100=right)
    // 0° = North at center (50), 90° E at right (75), 270° W at left (25)
    const azToX = (az: number) => (((az + 180) % 360) / 360) * 100;
    // Helper to convert azimuth to compass direction
    const azToCompass = (az: number) => {
      const dirs = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
      ];
      return dirs[Math.round((az % 360) / 22.5) % 16];
    };
    // Helper to convert radius to y (altitude) for window view (fixed at 10km)
    const y = (10 / 12) * 70; // 10km out of 12km max altitude (scaled down to avoid clipping)    // Build marker objects
    const markers = cones.flatMap(({ label, start, end }) => {
      const mid = (start + end) / 2;
      const width = (end - start + 360) % 360;
      return [
        {
          x: azToX(start),
          y,
          callsign: `${label} Start`,
          altitude: -1, // negative altitude to indicate not a real plane
          isMarker: true,
          azimuth: start,
          compass: azToCompass(start),
          icao: `marker-${label}-start`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(mid),
          y,
          callsign: label,
          altitude: -1,
          isMarker: true,
          azimuth: mid,
          compass: azToCompass(mid),
          icao: `marker-${label}-mid`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(end),
          y,
          callsign: `${label} End`,
          altitude: -1,
          isMarker: true,
          azimuth: end,
          compass: azToCompass(end),
          icao: `marker-${label}-end`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
      ];
    });
    // Merge with actual planes for overlay, preserving all real planes (including grounded) and adding markers
    if (this.windowViewOverlayComponent) {
      this.windowViewOverlayComponent.windowViewPlanes = [
        // keep only real plane entries (exclude marker objects)
        ...windowViewPlanes.filter((p) => !p.isMarker),
        // then append marker entries
        ...markers,
      ];
    }
  }

  /**
   * Calculate azimuth (bearing) from one point to another
   */
  private calculateAzimuth(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
  ): number {
    // Use the existing computeBearing utility function
    return this.computeBearing(fromLat, fromLon, toLat, toLon);
  }

  /**
   * Compute bearing between two points
   */
  private computeBearing(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
  ): number {
    const dLon = ((toLon - fromLon) * Math.PI) / 180;
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  }
}
