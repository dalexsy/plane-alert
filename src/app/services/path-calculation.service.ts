import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel, PositionHistory } from '../models/plane-model';
import { AltitudeColorService } from './altitude-color.service';

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
export class PathCalculationService {
  private pathCache = new Map<
    string,
    { timestamp: number; points: [number, number][] }
  >();
  private readonly PATH_CACHE_DURATION = 250; // ms

  constructor(private altitudeColorService: AltitudeColorService) {}

  updatePlanePath(
    map: L.Map,
    plane: PlaneModel,
    lat: number,
    lon: number,
    track: number | null,
    velocity: number | null,
    altitude: number | null,
    isGrounded: boolean
  ): L.Polyline | undefined {
    // Remove predicted path only when we cannot compute movement.
    // Grounded planes can still taxi; if they have track + positive velocity,
    // render a path so their ghost marker remains visually associated.
    if (
      track == null ||
      velocity == null ||
      (velocity !== null && velocity <= 0)
    ) {
      this.removePredictedPath(plane, map);
      return undefined;
    }

    const pathPoints = this.calculatePredictedPath(
      lat,
      lon,
      track,
      velocity,
      plane.positionHistory
    );

    if (pathPoints.length >= 2) {
      return this.updatePredictedPathPolyline(plane, map, pathPoints, altitude);
    } else {
      this.removePredictedPath(plane, map);
      return undefined;
    }
  }

  private calculatePredictedPath(
    lat: number,
    lon: number,
    track: number,
    velocity: number,
    positionHistory: PositionHistory[]
  ): [number, number][] {
    const now = Date.now();
    const key = `${lat.toFixed(4)},${lon.toFixed(4)},${track},${Math.round(
      velocity ?? 0
    )}`;

    // Check cache first
    const cacheEntry = this.pathCache.get(key);
    if (cacheEntry && now - cacheEntry.timestamp < this.PATH_CACHE_DURATION) {
      return cacheEntry.points;
    }

    const pathPoints: [number, number][] = [[lat, lon]];
    const minutesAhead = 1;

    // Calculate turn rate from history
    const turnRateData = this.calculateTurnRate(positionHistory, track);
    const usesTurnRate = Math.abs(turnRateData.turnRatePerMin) > 0.5;

    if (usesTurnRate) {
      pathPoints.push(
        ...this.generateCurvedPath(
          lat,
          lon,
          track,
          velocity,
          minutesAhead,
          turnRateData.turnRatePerMin
        )
      );
    } else {
      pathPoints.push(
        ...this.generateStraightPath(lat, lon, track, velocity, minutesAhead)
      );
    }

    // Apply smoothing and filtering
    const processedPoints = this.processPathPoints(pathPoints, usesTurnRate);

    // Cache the result
    this.pathCache.set(key, { timestamp: now, points: processedPoints });

    return processedPoints;
  }

  private calculateTurnRate(
    positionHistory: PositionHistory[],
    currentTrack: number
  ): { turnRatePerMin: number } {
    if (positionHistory.length < 3) {
      return { turnRatePerMin: 0 };
    }

    const recentTracks: { track: number; timestamp: number }[] = [];

    // Collect recent tracks from history
    for (
      let i = Math.max(0, positionHistory.length - 5);
      i < positionHistory.length;
      i++
    ) {
      if (positionHistory[i].track != null) {
        recentTracks.push({
          track: positionHistory[i].track!,
          timestamp: positionHistory[i].timestamp,
        });
      }
    }

    // Add current track
    if (currentTrack != null) {
      recentTracks.push({
        track: currentTrack,
        timestamp: Date.now(),
      });
    }

    if (recentTracks.length < 3) {
      return { turnRatePerMin: 0 };
    }

    // Calculate average turn rate
    let totalTurnRate = 0;
    let validPairs = 0;

    for (let i = 1; i < recentTracks.length; i++) {
      const t1 = recentTracks[i].track;
      const t0 = recentTracks[i - 1].track;
      const dtMin =
        (recentTracks[i].timestamp - recentTracks[i - 1].timestamp) / 60000;

      if (dtMin >= 0.1 && dtMin <= 5) {
        let rawDelta = ((t1 - t0 + 540) % 360) - 180;
        const turnRate = rawDelta / dtMin;
        if (Math.abs(turnRate) <= 10) {
          totalTurnRate += turnRate;
          validPairs++;
        }
      }
    }

    const turnRatePerMin = validPairs > 0 ? totalTurnRate / validPairs : 0;
    return { turnRatePerMin };
  }

  private generateCurvedPath(
    lat: number,
    lon: number,
    track: number,
    velocity: number,
    minutesAhead: number,
    turnRatePerMin: number
  ): [number, number][] {
    const points: [number, number][] = [];
    const pointsCount = 12;
    const timeStep = minutesAhead / pointsCount;
    const dampedTurnRate = turnRatePerMin * 0.7; // Reduce turn rate by 30%

    let curLat = lat;
    let curLon = lon;
    let curHeading = track;

    for (let i = 1; i <= pointsCount; i++) {
      curHeading =
        (((curHeading + dampedTurnRate * timeStep) % 360) + 360) % 360;

      const brng = (curHeading * Math.PI) / 180;
      const speedKmPerHr = velocity * 1.852;
      const distanceKm = (speedKmPerHr * timeStep) / 60;
      const R = 6371;

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
      points.push([curLat, curLon]);
    }

    return points;
  }

  private generateStraightPath(
    lat: number,
    lon: number,
    track: number,
    velocity: number,
    minutesAhead: number
  ): [number, number][] {
    const points: [number, number][] = [];
    const pointsCount = 6;
    const timeStep = minutesAhead / pointsCount;

    const brng = (track * Math.PI) / 180;
    const speedKmPerHr = velocity * 1.852;
    const R = 6371;

    for (let i = 1; i <= pointsCount; i++) {
      const distanceKm = (speedKmPerHr * timeStep * i) / 60;
      const lat1 = (lat * Math.PI) / 180;
      const lon1 = (lon * Math.PI) / 180;
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

      points.push([(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI]);
    }

    return points;
  }

  private processPathPoints(
    pathPoints: [number, number][],
    usesTurnRate: boolean
  ): [number, number][] {
    // Apply smoothing for curved paths
    if (usesTurnRate && pathPoints.length >= 4) {
      try {
        const smoothedPoints: [number, number][] = [pathPoints[0]];
        for (let i = 1; i < pathPoints.length - 1; i++) {
          const prev = pathPoints[i - 1];
          const curr = pathPoints[i];
          const next = pathPoints[i + 1];
          const smoothedLat = (prev[0] + curr[0] + next[0]) / 3;
          const smoothedLon = (prev[1] + curr[1] + next[1]) / 3;
          smoothedPoints.push([smoothedLat, smoothedLon]);
        }
        smoothedPoints.push(pathPoints[pathPoints.length - 1]);
        pathPoints = smoothedPoints;
      } catch (e) {
        console.warn('Path smoothing failed, using original points');
      }
    }

    // Cap path length and remove outliers
    const maxDistanceKm = 25;
    pathPoints = pathPoints.filter((pt, index) => {
      if (index === 0) return true;
      const dist = this.haversineDistance(
        pathPoints[0][0],
        pathPoints[0][1],
        pt[0],
        pt[1]
      );
      return dist <= maxDistanceKm;
    });

    // Remove points that are too close together
    const minDistanceKm = 0.5;
    const filteredPoints: [number, number][] = [pathPoints[0]];

    for (let i = 1; i < pathPoints.length; i++) {
      const lastPoint = filteredPoints[filteredPoints.length - 1];
      const currentPoint = pathPoints[i];
      const dist = this.haversineDistance(
        lastPoint[0],
        lastPoint[1],
        currentPoint[0],
        currentPoint[1]
      );

      if (dist >= minDistanceKm) {
        filteredPoints.push(currentPoint);
      }
    }

    return filteredPoints;
  }

  private updatePredictedPathPolyline(
    plane: PlaneModel,
    map: L.Map,
    pathPoints: [number, number][],
    altitude: number | null
  ): L.Polyline {
    // Get color for altitude
    const altKey = altitude ?? 0;
    const color = this.getAltitudeColor(altKey);

    if (plane.path) {
      plane.path.setLatLngs(pathPoints);
      plane.path.setStyle({
        className: 'predicted-path-line',
        color: color,
      });
    } else {
      plane.path = L.polyline(pathPoints, {
        className: 'predicted-path-line',
        color: color,
        interactive: false,
        pane: 'overlayPane',
      }).addTo(map);
    }

    // Update or create arrowhead
    this.updatePathArrowhead(plane, map, pathPoints, altKey);

    return plane.path;
  }

  private updatePathArrowhead(
    plane: PlaneModel,
    map: L.Map,
    pathPoints: [number, number][],
    altKey: number
  ): void {
    if (pathPoints.length >= 2) {
      const color = this.getAltitudeColor(altKey);
      const endPoint = pathPoints[pathPoints.length - 1];
      const prevPoint = pathPoints[pathPoints.length - 2];
      const bearing = this.computeBearing(
        prevPoint[0],
        prevPoint[1],
        endPoint[0],
        endPoint[1]
      );
      const rotation = bearing - 90;

      const arrowheadIcon = L.divIcon({
        html: `<div style="transform: rotate(${rotation}deg); color: ${color};">▶</div>`,
        className: 'predicted-path-arrowhead',
        iconSize: [20, 20],
        iconAnchor: [11, 11],
      });

      if (plane.predictedPathArrowhead) {
        plane.predictedPathArrowhead.setLatLng(endPoint);
        plane.predictedPathArrowhead.setIcon(arrowheadIcon);
      } else {
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

  private removePredictedPath(plane: PlaneModel, map: L.Map): void {
    if (plane.path) {
      map.removeLayer(plane.path);
      plane.path = undefined;
    }
    if (plane.predictedPathArrowhead) {
      map.removeLayer(plane.predictedPathArrowhead);
      plane.predictedPathArrowhead = undefined;
    }
  }

  updateHistoricalTrail(
    map: L.Map,
    plane: PlaneModel,
    lat: number,
    lon: number,
    altitude: number | null,
    isGrounded: boolean
  ): void {
    if (!plane.positionHistory || plane.positionHistory.length < 2) {
      plane.removeHistoryTrailSegments(map);
      return;
    }

    const historyAltitudes = plane.positionHistory
      .map((entry) =>
        typeof entry?.altitude === 'number' && !Number.isNaN(entry.altitude)
          ? entry.altitude
          : null
      )
      .filter((value): value is number => value !== null);
    const latestAltitude =
      typeof altitude === 'number'
        ? altitude
        : plane.positionHistory[plane.positionHistory.length - 1]?.altitude ??
          null;
    const maxHistoryAltitude =
      historyAltitudes.length > 0 ? Math.max(...historyAltitudes) : undefined;
    if (
      historyAltitudes.length === 0 ||
      (typeof maxHistoryAltitude === 'number' && maxHistoryAltitude <= 50)
    ) {
      console.debug('History trail altitude check', {
        icao: plane.icao,
        sampleCount: plane.positionHistory.length,
        latestAltitude,
        maxHistoryAltitude,
        minHistoryAltitude:
          historyAltitudes.length > 0
            ? Math.min(...historyAltitudes)
            : undefined,
        recentSamples: historyAltitudes.slice(-5),
      });
    }

    const rawHistory = plane.positionHistory.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      alt: p.altitude ?? 0,
    }));
    rawHistory.push({ lat, lon, alt: altitude ?? 0 });

    const rawPoints: [number, number][] = rawHistory.map((p) => [p.lat, p.lon]);
    const smoothPoints = this.smoothPoints(rawPoints);

    if (smoothPoints.length < 2) {
      plane.removeHistoryTrailSegments(map);
      return;
    }

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

      const segAlt1 = rawHistory[i]?.alt ?? 0;
      const segAlt2 = rawHistory[i + 1]?.alt ?? 0;

      let prevPt: L.LatLngExpression = interpolatedPoints[0];

      for (let k = 1; k < interpolatedPoints.length; k++) {
        const t = k / (interpolatedPoints.length - 1);
        const altAtT = segAlt1 + (segAlt2 - segAlt1) * t;
        const segColor = this.getAltitudeColor(altAtT);

        const segment = L.polyline([prevPt, interpolatedPoints[k]], {
          className: 'history-trail-segment',
          color: segColor,
          weight: 4,
          opacity: opacity,
          interactive: false,
        }).addTo(map);

        plane.historyTrailSegments!.push(segment);
        prevPt = interpolatedPoints[k];
      }
    }
  }

  private smoothPoints(points: [number, number][]): [number, number][] {
    const smoothPoints: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      let latSum = 0,
        lonSum = 0,
        count = 0;
      for (
        let j = Math.max(0, i - 1);
        j <= Math.min(points.length - 1, i + 1);
        j++
      ) {
        if (
          typeof points[j]?.[0] === 'number' &&
          typeof points[j]?.[1] === 'number'
        ) {
          latSum += points[j][0];
          lonSum += points[j][1];
          count++;
        }
      }
      if (count > 0) {
        smoothPoints.push([latSum / count, lonSum / count]);
      }
    }
    return smoothPoints;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private computeBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  private getAltitudeColor(altitude: number): string {
    // Altitude is already in meters from the plane data service
    return this.altitudeColorService.getFillColor(altitude);
  }
}
