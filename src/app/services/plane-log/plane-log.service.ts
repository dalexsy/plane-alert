import { Injectable } from '@angular/core';
import { PlaneModel } from '../../models/plane-model';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapOverlayStateService } from '../map/map-overlay-state.service';
import { SettingsService } from '../settings/settings.service';
import { HelicopterIdentificationService } from '../helicopter-identification/helicopter-identification.service';
import { updateWindowViewPlanes } from './plane-log-window.util';

const MAX_HISTORICAL_PLANES = 250;

@Injectable({ providedIn: 'root' })
export class PlaneLogService {
  private planeLog = new Map<string, PlaneModel>();
  private planeHistoricalLog: PlaneModel[] = [];
  resultsOverlayComponent!: ResultsOverlayComponent;
  windowViewOverlayComponent?: WindowViewOverlayComponent;
  overlay!: MapOverlayStateService;

  constructor(
    public settings: SettingsService,
    public helicopterIdentificationService: HelicopterIdentificationService
  ) {}

  initialize(
    resultsOverlayComponent: ResultsOverlayComponent,
    windowViewOverlayComponent?: WindowViewOverlayComponent
  ): void {
    this.resultsOverlayComponent = resultsOverlayComponent;
    this.windowViewOverlayComponent = windowViewOverlayComponent;
  }

  setOverlayState(overlay: MapOverlayStateService): void {
    this.overlay = overlay;
  }

  /** @deprecated use setOverlayState */
  setMapComponent(overlay: MapOverlayStateService): void {
    this.setOverlayState(overlay);
  }

  getLog(): Map<string, PlaneModel> {
    return this.planeLog;
  }

  getHistoricalLog(): PlaneModel[] {
    return this.planeHistoricalLog;
  }

  updateLog(updatedPlanes: PlaneModel[]): void {
    this.planeLog.clear();
    for (const plane of updatedPlanes) this.planeLog.set(plane.icao, plane);
  }

  updateHistoricalLog(planes: PlaneModel[]): void {
    this.planeHistoricalLog = planes;
  }

  clearHistoricalLog(): void {
    this.planeHistoricalLog = [];
  }

  updatePlaneLog(planes: PlaneModel[]): PlaneModel[] {
    planes.forEach((p) => {
      p.airportCode = undefined;
      p.airportName = undefined;
    });
    const centerLat = this.settings.lat ?? 52.3667;
    const centerLon = this.settings.lon ?? 13.5033;
    const visiblePlanes = planes.filter((p) => !p.filteredOut && p.lat != null && p.lon != null);
    visiblePlanes.sort((a, b) => a.firstSeen - b.firstSeen);
    this.overlay.skyPlaneLog = visiblePlanes as unknown as PlaneLogEntry[];
    this.overlay.airportPlaneLog = visiblePlanes.filter((p) => p.airportCode != null) as unknown as PlaneLogEntry[];
    updateWindowViewPlanes(this, visiblePlanes, centerLat, centerLon);
    const mergedMap = new Map<string, PlaneModel>();
    for (const plane of this.planeHistoricalLog) mergedMap.set(plane.icao, plane);
    for (const plane of planes) mergedMap.set(plane.icao, plane);
    const updatedHistoricalLog = Array.from(mergedMap.values());
    updatedHistoricalLog.sort((a, b) => b.firstSeen - a.firstSeen);
    const activeIcaos = new Set(planes.map((plane) => plane.icao));
    const cappedHistoricalLog = [
      ...updatedHistoricalLog.filter((plane) => activeIcaos.has(plane.icao)),
      ...updatedHistoricalLog.filter((plane) => !activeIcaos.has(plane.icao)),
    ].slice(0, MAX_HISTORICAL_PLANES);
    const historyFiltered = cappedHistoricalLog
      .filter((p) => !p.filteredOut)
      .sort((a, b) => b.firstSeen - a.firstSeen);
    const militaryPlanes = historyFiltered.filter((p) => p.isMilitary);
    const otherPlanes = historyFiltered.filter((p) => !p.isMilitary);
    this.overlay.seenPlaneLog = [...militaryPlanes, ...otherPlanes] as unknown as PlaneLogEntry[];
    this.planeHistoricalLog = cappedHistoricalLog;
    return cappedHistoricalLog;
  }
}
