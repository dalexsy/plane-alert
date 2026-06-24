import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import type { WindowViewPlane } from '../../components/window-view-overlay/window-view-overlay.component';

/** Shared overlay list state previously held on MapComponent. */
@Injectable({ providedIn: 'root' })
export class MapOverlayStateService {
  skyPlaneLog: PlaneLogEntry[] = [];
  airportPlaneLog: PlaneLogEntry[] = [];
  seenPlaneLog: PlaneLogEntry[] = [];
  windowViewPlanes: WindowViewPlane[] = [];

  closestPlane: PlaneModel | null = null;
  closestDistance: number | null = null;
  closestOperator: string | null = null;
  closestSecondsAway: number | null = null;
  closestVelocity: number | null = null;
  locationStreet: string | null = null;
  locationDistrict: string | null = null;

  airportCircles = new Map<number, L.Circle>();
  clickedAirports = new Set<number>();
  activePlaneIcaos = new Set<string>();
  highlightedPlaneIcao: string | null = null;
  followNearest = false;
}
