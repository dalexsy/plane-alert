import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../models/plane-model';
import { AltitudeColorService } from './altitude-color.service';
import {
  calculatePredictedPath,
  removePredictedPath,
  updatePredictedPathPolyline,
} from './path-calculation/path-predicted.util';
import { updateHistoricalTrailSegments } from './path-calculation/path-trail.util';

@Injectable({ providedIn: 'root' })
export class PathCalculationService {
  private pathCache = new Map<string, { timestamp: number; points: [number, number][] }>();
  private readonly PATH_CACHE_DURATION = 250;

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
    if (track == null || velocity == null || isGrounded || (velocity !== null && velocity <= 0)) {
      removePredictedPath(plane, map);
      if (isGrounded) plane.removeHistoryTrailSegments(map);
      return undefined;
    }
    const pathPoints = calculatePredictedPath(
      lat,
      lon,
      track,
      velocity,
      plane.positionHistory,
      this.pathCache,
      this.PATH_CACHE_DURATION
    );
    if (pathPoints.length >= 2) {
      const color = this.altitudeColorService.getFillColor(altitude ?? 0);
      return updatePredictedPathPolyline(plane, map, pathPoints, color);
    }
    removePredictedPath(plane, map);
    return undefined;
  }

  updateHistoricalTrail(
    map: L.Map,
    plane: PlaneModel,
    lat: number,
    lon: number,
    altitude: number | null,
    isGrounded: boolean
  ): void {
    if (isGrounded) {
      plane.removeHistoryTrailSegments(map);
      return;
    }
    updateHistoricalTrailSegments(map, plane, lat, lon, altitude, (alt) =>
      this.altitudeColorService.getFillColor(alt)
    );
  }
}
