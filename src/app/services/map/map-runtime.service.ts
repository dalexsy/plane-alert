import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { ViewConeConfig } from '../settings.service';

@Injectable({ providedIn: 'root' })
export class MapRuntimeService {
  readonly DEFAULT_COORDS: [number, number] = [52.3667, 13.5033];

  map!: L.Map;
  planeNewTimestamps = new Map<string, number>();
  planeLog = new Map<string, PlaneModel>();
  planeHistoricalLog: PlaneModel[] = [];

  currentLocationMarker!: L.Marker;
  homeMarker: L.Marker | null = null;
  airportRadiusKm = 3;
  manualUpdate = false;
  locationErrorShown = false;

  cloudOpacity = 1;
  rainOpacity = 0.8;

  isProgrammaticMove = false;
  isResizing = false;
  resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  svgPatternRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  cloudLayer?: L.TileLayer;
  rainLayer?: L.TileLayer;

  centerZoom: number | null = null;
  currentFaviconUrl = '';
  showConeConfigEditor = false;
  viewConesConfig: ViewConeConfig[] = [];

  isProcessingFollowRequest = false;
  currentTime = '';

  windAngle = 0;
  windSpeed = 0;
  windStat = 0;

  globalTooltipClickHandler!: (e: MouseEvent) => void;
}
