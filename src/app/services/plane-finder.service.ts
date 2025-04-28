// src/app/services/plane-finder.service.ts
import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
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
import { SpecialListService } from './special-list.service';
import { OperatorCallSignService } from './operator-call-sign.service';
import { MilitaryPrefixService } from './military-prefix.service';

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

  constructor(
    private newPlaneService: NewPlaneService,
    private settings: SettingsService,
    private helicopterListService: HelicopterListService,
    private specialListService: SpecialListService,
    private operatorCallSignService: OperatorCallSignService, // inject our service
    private militaryPrefixService: MilitaryPrefixService
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
    altitude: number | null,
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
      // Predict path using recent turn rate for smooth curvature
      const minutesAhead = 2;
      const pointsCount = 15;
      const timeStep = minutesAhead / pointsCount;
      const hist = plane.positionHistory;
      // Determine turn rate (deg per minute) from last two history entries
      let turnRatePerMin = 0;
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
        if (dtMin >= 0.1) {
          const rawDelta = ((t1 - t0 + 540) % 360) - 180;
          turnRatePerMin = rawDelta / dtMin;
        }
      }
      let curLat = lat;
      let curLon = lon;
      let curHeading = track ?? hist[hist.length - 1]?.track ?? 0;
      for (let i = 1; i <= pointsCount; i++) {
        // apply turn rate
        curHeading =
          (((curHeading + turnRatePerMin * timeStep) % 360) + 360) % 360;
        const brng = (curHeading * Math.PI) / 180;
        const distanceKm = ((velocity ?? 0) * 60 * timeStep) / 1000;
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

      // Apply smoothing if we have enough points
      if (pathPoints.length >= 3) {
        // Convert to GeoJSON LineString with [lon, lat]
        const line = turf.lineString(
          pathPoints.map(([lat, lon]) => [lon, lat])
        );
        // Higher resolution and sharpness improve curve smoothness
        const spline = turf.bezierSpline(line, {
          resolution: pointsCount * 4,
          sharpness: 0.85,
        });
        // Convert back to [lat, lon]
        pathPoints = spline.geometry.coordinates.map(([lon, lat]) => [
          lat,
          lon,
        ]);
      }

      // Cap the path length to a maximum distance (e.g., 50 km) from the current position
      const maxDistanceKm = 20; // increased to 50 km for 10x longer cap
      pathPoints = pathPoints.filter((pt) => {
        const dist = haversineDistance(lat, lon, pt[0], pt[1]);
        return dist <= maxDistanceKm;
      });
      // Only draw non-degenerate predicted paths (at least two unique points after capping)
      const uniquePoints = Array.from(
        new Set(pathPoints.map((p) => p.join(',')))
      );
      if (uniquePoints.length >= 2) {
        // Determine color based on predicted altitude
        const maxPredAlt = 12000;
        const predHue =
          altitude != null ? Math.min(altitude / maxPredAlt, 1) * 300 : 0;
        const predColor = `hsl(${predHue},100%,50%)`;
        // Update existing or create new polyline with altitude-based color
        if (plane.path) {
          plane.path.setLatLngs(pathPoints);
          plane.path.setStyle({
            className: 'predicted-path-line',
            color: predColor,
          });
        } else {
          plane.path = L.polyline(pathPoints, {
            className: 'predicted-path-line',
            color: predColor,
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
        // Compute arrow color based on predicted altitude
        const maxPredAlt = 12000;
        const arrowHue =
          altitude != null ? Math.min(altitude / maxPredAlt, 1) * 300 : 0;
        const arrowColor = `hsl(${arrowHue},100%,50%)`;
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
          html: `<div style="transform: rotate(${rotation}deg); color: ${arrowColor};">▶</div>`,
          className: 'predicted-path-arrowhead',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        if (plane.predictedPathArrowhead) {
          plane.predictedPathArrowhead.setLatLng(endPoint);
          plane.predictedPathArrowhead.setIcon(arrowheadIcon);
        } else {
          // Use default pane for marker so Leaflet places it correctly
          plane.predictedPathArrowhead = L.marker(endPoint, {
            icon: arrowheadIcon,
            interactive: false,
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
      const maxAltitude = 12000; // same scale as marker coloring
      // Build history with altitude
      const rawHistory = plane.positionHistory.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        alt: p.altitude ?? 0,
      }));
      rawHistory.push({ lat, lon, alt: altitude ?? 0 });
      const rawPoints: [number, number][] = rawHistory.map((p) => [
        p.lat,
        p.lon,
      ]);

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
          // Determine color by altitude at this segment (use rawHistory)
          const segAlt = rawHistory[i + 1]?.alt ?? 0;
          const hue = Math.min(segAlt / maxAltitude, 1) * 300;
          const segColor = `hsl(${hue},100%,50%)`;

          const segment = L.polyline(interpolatedPoints, {
            color: segColor,
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
    // Refresh custom lists before scanning
    await this.helicopterListService.refreshHelicopterList(manualUpdate);
    await this.specialListService.refreshSpecialList(manualUpdate);
    // Load any configured military prefixes
    await this.militaryPrefixService.loadPrefixes();

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
      const isSpecial = this.specialListService.isSpecial(id);

      // Define isFiltered early after getting necessary info
      const aircraft = getAircraftInfo(id);
      // Treat any callsign matching configured prefixes as military
      const prefixIsMil =
        this.militaryPrefixService.isMilitaryCallsign(callsign);
      const isMilitary = prefixIsMil || aircraft?.mil || false;
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
          isSpecial: isSpecial,
        };
        planeModelInstance = new PlaneModel(initialPlaneData);
        // Apply forced military flag on the model (not part of Plane interface)
        planeModelInstance.isMilitary = isMilitary;
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
        planeModelInstance.isSpecial = isSpecial;
        planeModelInstance.isMilitary = isMilitary; // update forced military flag
      }

      // Update PlaneModel with potentially fetched aircraft data
      // Determine operator via prefix mapping or fallback to ownop from aircraft info
      const prefixOperator = this.operatorCallSignService.getOperator(callsign);
      const operator = prefixOperator ?? (aircraft?.ownop || '');
      const model = aircraft?.model || '';
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
        planeModelInstance.addPositionToHistory(
          lat,
          lon,
          track,
          velocity,
          altitude
        );
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
      const speedText = velocity ? (velocity * 3.6).toFixed(0) + 'km/h' : '';
      const altText = altitude ? altitude.toFixed(0) + 'm' : '';
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
        isSpecial,
        verticalRate
      );
      const extraStyle = this.computeExtraStyle(altitude, onGround);

      // Custom icon mapping removed, always use default icon
      const customPlaneIcon = '';

      const { marker } = createOrUpdatePlaneMarker(
        planeModelInstance.marker, // Pass existing marker from model
        map,
        lat,
        lon,
        track ?? 0,
        extraStyle,
        isNew,
        onGround,
        tooltip,
        customPlaneIcon, // Pass custom icon HTML if ICAO matches
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
        altitude,
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

      const aircraft = getAircraftInfo(plane.icao);
      // Determine military flag based on configured prefixes or DB
      const prefixIsMil2 = this.militaryPrefixService.isMilitaryCallsign(
        plane.callsign
      );
      const isMilitary = prefixIsMil2 || aircraft?.mil || false;

      // Update marker/tooltip classes based on final state
      if (plane.marker) {
        const element = plane.marker.getElement();
        const tooltipElement = plane.marker.getTooltip()?.getElement();

        if (element) {
          element.classList.toggle('grounded-plane', plane.onGround);
          element.classList.toggle('new-plane', !plane.onGround && stillNew);
          element.classList.toggle('special-plane', plane.isSpecial || false);
        }
        if (tooltipElement) {
          tooltipElement.classList.toggle('new-plane-tooltip', stillNew);
          tooltipElement.classList.toggle('military-plane-tooltip', isMilitary);
          tooltipElement.classList.toggle(
            'grounded-plane-tooltip',
            plane.onGround
          );
          tooltipElement.classList.toggle(
            'special-plane-tooltip',
            plane.isSpecial || false
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
