// src/app/services/plane-finder.service.ts
import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import {
  haversineDistance,
  computeBearing,
  getCardinalDirection,
  getArrowForDirection,
} from '../utils/geo-utils';
import { filterPlaneByPrefix } from '../utils/plane-log';
import { Plane } from '../types/plane';
import { createOrUpdatePlaneMarker } from '../utils/plane-marker';
import { planeTooltip } from '../utils/tooltip';
import { PlaneModel } from '../models/plane-model';
import { NewPlaneService } from '../services/new-plane.service';
import { SettingsService } from './settings.service';
import { HelicopterListService } from './helicopter-list.service';

// Helper function for Catmull-Rom interpolation
function catmullRomPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;

  const lat =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

  const lon =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

  return [lat, lon];
}

@Injectable({
  providedIn: 'root',
})
export class PlaneFinderService {
  private mapInitialized = false;
  private isInitialLoad = false;

  setInitialLoad(value: boolean): void {
    this.isInitialLoad = value;
  }

  constructor(
    private newPlaneService: NewPlaneService,
    private settings: SettingsService,
    private helicopterListService: HelicopterListService
  ) {}

  private randomizeBrightness(): string {
    const brightness = (Math.random() * 0.4 + 0.8).toFixed(2);
    return `filter: brightness(${brightness});`;
  }

  private computeExtraStyle(
    altitude: number | null,
    isGrounded: boolean
  ): string {
    if (isGrounded) {
      return this.randomizeBrightness();
    }
    const maxAltitude = 12000;
    if (altitude == null) {
      return '';
    }
    const hue = Math.min(altitude / maxAltitude, 1) * 300;
    return `color: hsl(${hue}, 100%, 50%);`;
  }

  private removePlaneVisuals(plane: PlaneModel, map: L.Map): void {
    plane.marker?.remove();
    plane.path?.remove();
    plane.predictedPathArrowhead?.remove(); // Remove arrowhead
    plane.removeHistoryTrailSegments(map); // Use helper method
  }

  private updatePlanePath(
    map: L.Map,
    plane: PlaneModel, // Pass the full PlaneModel instance
    lat: number,
    lon: number,
    track: number | null,
    velocity: number | null,
    isGrounded: boolean
  ): L.Polyline | undefined {
    // Return type is only for the predicted path

    // --- PREDICTED PATH ---
    // Remove the predicted path for grounded planes or those without track/velocity data
    if (track == null || velocity == null || isGrounded) {
      if (plane.path) {
        map.removeLayer(plane.path);
        plane.path = undefined; // Clear reference on the model
      }
      // Remove arrowhead if predicted path is removed
      if (plane.predictedPathArrowhead) {
        map.removeLayer(plane.predictedPathArrowhead);
        plane.predictedPathArrowhead = undefined;
      }
      // Also remove historical path if grounded
      if (isGrounded) {
        plane.removeHistoryTrailSegments(map); // Use helper
      }
      // No predicted path to draw
      // Historical path handled below
    } else {
      // Calculate predicted path points
      let pathPoints: [number, number][] = [[lat, lon]];
      // Compute turn rate (deg/min) from last two history entries, if available
      let turnRate = 0;
      const hist = plane.positionHistory;
      if (
        hist.length >= 2 &&
        hist[hist.length - 1].track != null &&
        hist[hist.length - 2].track != null
      ) {
        const t1 = hist[hist.length - 1].track!;
        const t0 = hist[hist.length - 2].track!;
        const dtMin =
          (hist[hist.length - 1].timestamp - hist[hist.length - 2].timestamp) /
          60000;
        if (dtMin > 0) {
          turnRate = (t1 - t0) / dtMin;
        }
      }
      // Proceed with prediction, applying turnRate each step
      let weightedTrack = track;
      // Prediction window: 0.5 minutes (30 seconds) to keep paths shorter
      const minutesAhead = 0.5;
      const pointsCount = 15;
      let curLat = lat;
      let curLon = lon;
      let curTrack = weightedTrack;
      const timeStep = minutesAhead / pointsCount;
      for (let i = 1; i <= pointsCount; i++) {
        // Apply computed turn rate per minute
        curTrack = curTrack + turnRate * timeStep;
        curTrack = ((curTrack % 360) + 360) % 360; // Normalize track

        const brng = (curTrack * Math.PI) / 180;
        const distanceKm = (velocity * 60 * timeStep) / 1000; // Velocity in m/s, timeStep in minutes
        const R = 6371; // Earth radius in km
        const lat1 = (curLat * Math.PI) / 180;
        const lon1 = (curLon * Math.PI) / 180;
        const angDist = distanceKm / R;
        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(angDist) +
            Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
        );
        const lon2 =
          lon1 +
          Math.atan2(
            Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
            Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
          );
        curLat = (lat2 * 180) / Math.PI;
        curLon = (lon2 * 180) / Math.PI;
        pathPoints.push([curLat, curLon]);
      }
      // Smooth predicted path but always anchor the first point at the plane's current position
      const ctrlPts = pathPoints;
      const samples = 30;
      const smoothed: [number, number][] = [];
      if (ctrlPts.length > 0) {
        // Always start at true current location
        smoothed.push(ctrlPts[0]);
      }
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        smoothed.push(this.calculateCurvePoint(t, ctrlPts));
      }
      pathPoints = smoothed;

      // Cap the path length to a maximum distance (e.g., 5 km) from the current position
      const maxDistanceKm = 5;
      pathPoints = pathPoints.filter((pt) => {
        const dist = haversineDistance(lat, lon, pt[0], pt[1]);
        return dist <= maxDistanceKm;
      });
      // Only draw non-degenerate predicted paths (at least two unique points after capping)
      const uniquePoints = Array.from(
        new Set(pathPoints.map((p) => p.join(',')))
      );
      if (uniquePoints.length >= 2) {
        // Update existing or create new polyline
        if (plane.path) {
          plane.path.setLatLngs(pathPoints);
          plane.path.setStyle({ className: 'predicted-path-line' });
        } else {
          plane.path = L.polyline(pathPoints, {
            className: 'predicted-path-line',
            interactive: false,
            pane: 'overlayPane',
          }).addTo(map);
        }
      } else {
        // Remove any existing predicted path/arrow for degenerate point
        if (plane.path) {
          map.removeLayer(plane.path);
          plane.path = undefined;
        }
        if (plane.predictedPathArrowhead) {
          map.removeLayer(plane.predictedPathArrowhead);
          plane.predictedPathArrowhead = undefined;
        }
      }

      // --- Add/Update Arrowhead ---
      if (pathPoints.length >= 2) {
        const endPoint = pathPoints[pathPoints.length - 1];
        const prevPoint = pathPoints[pathPoints.length - 2];
        const bearing = computeBearing(
          prevPoint[0],
          prevPoint[1],
          endPoint[0],
          endPoint[1]
        );
        const rotation = bearing - 90; // Adjust rotation for '▶' default orientation

        const arrowheadIcon = L.divIcon({
          html: `<div style="transform: rotate(${rotation}deg);">▶</div>`,
          className: 'predicted-path-arrowhead',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        if (plane.predictedPathArrowhead) {
          plane.predictedPathArrowhead.setLatLng(endPoint);
          plane.predictedPathArrowhead.setIcon(arrowheadIcon);
        } else {
          plane.predictedPathArrowhead = L.marker(endPoint, {
            icon: arrowheadIcon,
            interactive: false,
            pane: 'pathArrowheadPane',
          }).addTo(map);
        }
      } else if (plane.predictedPathArrowhead) {
        map.removeLayer(plane.predictedPathArrowhead);
        plane.predictedPathArrowhead = undefined;
      }
    }

    // --- HISTORICAL TRAIL (ACTUAL PATH) ---
    if (
      plane.positionHistory &&
      plane.positionHistory.length > 1 &&
      !isGrounded
    ) {
      const rawPoints = plane.positionHistory.map((p) => [p.lat, p.lon]);
      rawPoints.push([lat, lon]);

      const smoothPoints: [number, number][] = [];
      for (let i = 0; i < rawPoints.length; i++) {
        let latSum = 0,
          lonSum = 0,
          count = 0;
        for (
          let j = Math.max(0, i - 1);
          j <= Math.min(rawPoints.length - 1, i + 1);
          j++
        ) {
          if (
            typeof rawPoints[j]?.[0] === 'number' &&
            typeof rawPoints[j]?.[1] === 'number'
          ) {
            latSum += rawPoints[j][0];
            lonSum += rawPoints[j][1];
            count++;
          }
        }
        if (count > 0) {
          smoothPoints.push([latSum / count, lonSum / count]);
        }
      }

      if (smoothPoints.length < 2) {
        plane.removeHistoryTrailSegments(map);
      } else {
        plane.removeHistoryTrailSegments(map);

        const numSegments = smoothPoints.length - 1;
        const minOpacity = 0.05;
        const maxOpacity = 0.7;
        const subdivisions = 6;

        for (let i = 0; i < numSegments; i++) {
          const p0 = smoothPoints[Math.max(0, i - 1)];
          const p1 = smoothPoints[i];
          const p2 = smoothPoints[i + 1];
          const p3 = smoothPoints[Math.min(smoothPoints.length - 1, i + 2)];

          const interpolatedPoints: L.LatLngExpression[] = [];
          interpolatedPoints.push(p1);

          for (let j = 1; j <= subdivisions; j++) {
            const t = j / subdivisions;
            interpolatedPoints.push(catmullRomPoint(t, p0, p1, p2, p3));
          }

          const opacity =
            minOpacity +
            (maxOpacity - minOpacity) *
              (i / (numSegments > 1 ? numSegments - 1 : 1));

          const segment = L.polyline(interpolatedPoints, {
            color: 'white',
            weight: 4,
            opacity: opacity,
            interactive: false,
          }).addTo(map);

          plane.historyTrailSegments!.push(segment);
        }
      }
    } else {
      plane.removeHistoryTrailSegments(map);
    }

    return plane.path;
  }

  // The following helper functions are no longer used for path visualization
  // but kept for future reference or other uses
  private generateCurvedPathControlPoints(
    historicalPoints: [number, number][],
    destinationPoint: [number, number]
  ): [number, number][] {
    const result: [number, number][] = [];

    // Add historical points
    for (const point of historicalPoints) {
      result.push(point);
    }

    // Add destination point
    result.push(destinationPoint);

    return result;
  }

  // Helper function to calculate a point on a curve using cardinal spline
  private calculateCurvePoint(
    t: number,
    points: [number, number][]
  ): [number, number] {
    if (points.length < 2) return points[0];

    // Simple case - linear interpolation between two points
    if (points.length === 2) {
      return [
        points[0][0] + t * (points[1][0] - points[0][0]),
        points[0][1] + t * (points[1][1] - points[0][1]),
      ];
    }

    // Cardinal spline interpolation for smoother curves
    const p = (points.length - 1) * t;
    const i = Math.floor(p);
    const t0 = p - i;

    // Get the four points needed for the spline
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Cardinal spline tension (0 to 1)
    const tension = 0.5;

    // Cardinal spline formula
    const t2 = t0 * t0;
    const t3 = t2 * t0;

    const s = (1 - tension) / 2;

    const h1 = 2 * t3 - 3 * t2 + 1;
    const h2 = -2 * t3 + 3 * t2;
    const h3 = t3 - 2 * t2 + t0;
    const h4 = t3 - t2;

    const lat =
      h1 * p1[0] +
      h2 * p2[0] +
      s * (h3 * (p2[0] - p0[0]) + h4 * (p3[0] - p1[0]));
    const lon =
      h1 * p1[1] +
      h2 * p2[1] +
      s * (h3 * (p2[1] - p0[1]) + h4 * (p3[1] - p1[1]));

    return [lat, lon];
  }

  async findPlanes(
    map: L.Map,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    excludeDiscount: boolean,
    blockedPrefixes: string[],
    planeNewTimestamps: Map<string, number>,
    getFlagHTML: (origin: string) => string,
    manualUpdate: boolean,
    onNewPlane: () => void,
    getAircraftInfo: (
      icao: string
    ) => { model?: string; ownop?: string; mil?: boolean } | null,
    previousLog: Map<string, PlaneModel> // Use PlaneModel here
  ): Promise<{
    anyNew: boolean;
    currentIDs: string[];
    updatedLog: PlaneModel[]; // Use PlaneModel here
  }> {
    // Refresh the helicopter list before scanning
    // Use the force parameter if this is a manual scan
    await this.helicopterListService.refreshHelicopterList(manualUpdate);

    if (!this.mapInitialized) {
      map.setView(
        [this.settings.mapLat ?? centerLat, this.settings.mapLon ?? centerLon],
        this.settings.mapZoom
      );
      map.on('moveend', () => {
        const c = map.getCenter();
        this.settings.setMapLat(c.lat);
        this.settings.setMapLon(c.lng);
      });
      map.on('zoomend', () => {
        this.settings.setMapZoom(map.getZoom());
      });
      this.mapInitialized = true;
    }

    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    const lamin = centerLat - latDelta;
    const lamax = centerLat + latDelta;
    const lomin = centerLon - lonDelta;
    const lomax = centerLon + lonDelta;
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}&extended=1`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch plane data');
    const data = await response.json();
    const currentUpdateSet = new Set<string>();
    const updatedLogModels: PlaneModel[] = []; // Store models
    let anyNew = false;

    data.states?.forEach((state: any[]) => {
      const id = state[0];
      const callsign = state[1]?.trim() || ''; // Define callsign early
      const origin: string = state[2] || 'Unknown';
      const lat = state[6];
      const lon = state[5];
      const track = state[10];
      const velocity = state[9];
      const altitude = state[13];
      const onGround = Boolean(state[8]); // Use descriptive variable

      // Define isFiltered early after getting necessary info
      const aircraft = getAircraftInfo(id);
      const isMilitary = aircraft?.mil || false;
      const wouldBeFiltered = filterPlaneByPrefix(
        callsign,
        excludeDiscount,
        blockedPrefixes
      );
      const isFiltered = this.isInitialLoad
        ? false
        : isMilitary
        ? false
        : wouldBeFiltered;

      currentUpdateSet.add(id);

      const dist = haversineDistance(centerLat, centerLon, lat, lon);
      if (dist > radiusKm) {
        // Clean up plane if it moved out of range
        const existingPlane = previousLog.get(id);
        if (existingPlane) {
          this.removePlaneVisuals(existingPlane, map); // Use helper
          previousLog.delete(id);
        }
        return;
      }

      const isNew = this.newPlaneService.isNew(id);
      if (isNew && !isFiltered) {
        // Simplified new plane logic
        anyNew = true;

        onNewPlane();
      }

      // Get or create PlaneModel instance
      let planeModelInstance = previousLog.get(id);
      const isExistingPlane = !!planeModelInstance; // Check if it existed before this scan

      if (!planeModelInstance) {
        // Create new PlaneModel if it doesn't exist
        const firstSeen = Date.now();
        const initialPlaneData: Plane = {
          // Create initial data structure (Type Plane, not PlaneModel)
          icao: id,
          callsign: callsign,
          origin: origin,
          firstSeen: firstSeen,
          model: '', // Will be updated below
          operator: '', // Will be updated below
          bearing: 0, // Will be updated below
          cardinal: '', // Will be updated below
          arrow: '', // Will be updated below
          isNew: isNew,
          lat: lat,
          lon: lon,
          marker: undefined, // Will be created below
          path: undefined, // Will be created below
          filteredOut: isFiltered,
          onGround: onGround,
          // Add track and velocity if available during creation
          track: track,
          velocity: velocity,
        };
        planeModelInstance = new PlaneModel(initialPlaneData);
        previousLog.set(id, planeModelInstance);
      } else {
        // If instance exists, update its core properties before visual updates
        planeModelInstance.callsign = callsign;
        planeModelInstance.origin = origin;
        planeModelInstance.lat = lat;
        planeModelInstance.lon = lon;
        planeModelInstance.filteredOut = isFiltered;
        planeModelInstance.onGround = onGround;
        planeModelInstance.isNew = isNew; // Keep track if it's still considered new in this scan cycle
      }

      // Update PlaneModel with potentially fetched aircraft data
      // Note: aircraft was already fetched above for filtering logic
      const model = aircraft?.model || '';
      const operator = aircraft?.ownop || '';
      // isMilitary already defined above

      planeModelInstance.model = model;
      planeModelInstance.operator = operator;

      // Calculate derived properties
      const bearing = computeBearing(centerLat, centerLon, lat, lon);
      const cardinal = getCardinalDirection(bearing);
      const arrow = getArrowForDirection(cardinal);
      planeModelInstance.bearing = bearing;
      planeModelInstance.cardinal = cardinal;
      planeModelInstance.arrow = arrow;

      // *** FIX: Explicitly add position to history for existing planes ***
      // The constructor handles the very first point for new planes.
      // This call handles all subsequent points for existing planes.
      // We need to ensure lat/lon are valid before adding.
      if (
        isExistingPlane &&
        typeof lat === 'number' &&
        typeof lon === 'number'
      ) {
        planeModelInstance.addPositionToHistory(lat, lon, track, velocity);
      } else if (
        !isExistingPlane &&
        (typeof lat !== 'number' || typeof lon !== 'number')
      ) {
        // Log if a new plane is created without valid initial coordinates
        console.warn(
          `[PlaneFinderService ${id}] New plane created without valid initial lat/lon:`,
          lat,
          lon
        );
      } else if (
        isExistingPlane &&
        (typeof lat !== 'number' || typeof lon !== 'number')
      ) {
        // Log if an existing plane receives invalid coordinates
        console.warn(
          `[PlaneFinderService ${id}] Existing plane received invalid lat/lon:`,
          lat,
          lon
        );
      }

      // Create/Update Marker
      const speedText = velocity ? (velocity * 3.6).toFixed(0) + ' km/h' : '';
      const altText = altitude ? altitude.toFixed(0) + ' m' : '';
      const verticalRate = state[11] ?? null;
      const tooltip = planeTooltip(
        id,
        callsign,
        origin,
        model,
        operator,
        speedText,
        altText,
        getFlagHTML,
        isNew,
        onGround,
        isMilitary,
        verticalRate
      );
      const extraStyle = this.computeExtraStyle(altitude, onGround);

      const { marker } = createOrUpdatePlaneMarker(
        planeModelInstance.marker, // Pass existing marker from model
        map,
        lat,
        lon,
        (track ?? 0) - 90,
        extraStyle,
        isNew,
        onGround,
        tooltip,
        '',
        isMilitary,
        model,
        this.helicopterListService.isHelicopter(id)
      );
      planeModelInstance.marker = marker; // Update marker reference on model

      // Update Predicted and Historical Paths (pass the model instance)
      this.updatePlanePath(
        map,
        planeModelInstance, // Pass the model
        lat,
        lon,
        track,
        velocity,
        onGround
      );
      // Note: updatePlanePath now modifies planeModelInstance.path and planeModelInstance.historyTrailSegments directly

      updatedLogModels.push(planeModelInstance); // Add the updated model to the list for this scan
    });

    // Remove planes that are no longer in the API response
    for (const [id, plane] of previousLog.entries()) {
      if (!currentUpdateSet.has(id)) {
        // Check against the set of IDs found in this scan
        this.removePlaneVisuals(plane, map); // Use helper
        previousLog.delete(id);
      }
    }

    // Update 'isNew' status and marker/tooltip classes for planes remaining
    // This loop is now simpler as the main update happened above
    updatedLogModels.forEach((plane) => {
      const stillNew = this.newPlaneService.isNew(plane.icao); // Check final 'new' status
      plane.isNew = stillNew; // Update the model's final 'new' status for the next cycle

      const aircraft = getAircraftInfo(plane.icao); // Re-get info for military status if needed
      const isMilitary = aircraft?.mil || false;

      // Update marker/tooltip classes based on final state
      if (plane.marker) {
        const element = plane.marker.getElement();
        const tooltipElement = plane.marker.getTooltip()?.getElement();

        if (element) {
          element.classList.toggle('grounded-plane', plane.onGround);
          element.classList.toggle('new-plane', !plane.onGround && stillNew);
        }
        if (tooltipElement) {
          tooltipElement.classList.toggle('new-plane-tooltip', stillNew);
          tooltipElement.classList.toggle('military-plane-tooltip', isMilitary);
          tooltipElement.classList.toggle(
            'grounded-plane-tooltip',
            plane.onGround
          );
        }
      }
      // No need to set previousLog here, it was updated directly earlier
    });

    this.newPlaneService.updatePlanes(currentUpdateSet);
    return {
      anyNew,
      currentIDs: Array.from(currentUpdateSet),
      updatedLog: Array.from(previousLog.values()), // Return the updated models
    };
  }
}
