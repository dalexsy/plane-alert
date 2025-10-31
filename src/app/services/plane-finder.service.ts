import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../models/plane-model';
import { SettingsService } from './settings.service';
import { PlaneDataService, ProcessedPlaneData } from './plane-data.service';
import { PathCalculationService } from './path-calculation.service';
import { PlaneVisualizationService } from './plane-visualization.service';
import { TooltipUpdateService } from './tooltip-update.service';
import { DistanceUnit } from '../utils/units.util';

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
    private settings: SettingsService,
    private planeDataService: PlaneDataService,
    private pathCalculationService: PathCalculationService,
    private planeVisualizationService: PlaneVisualizationService,
    private tooltipUpdateService: TooltipUpdateService
  ) {
    // Subscribe to unit changes to update all existing tooltips
    this.settings.distanceUnitChanged.subscribe(() => {
      this.tooltipUpdateService.updateAllTooltipsForUnitChange();
    });
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
    previousLog: Map<string, PlaneModel>,
    followedIcao?: string | null,
    followNearest?: boolean
  ): Promise<{
    anyNew: boolean;
    currentIDs: string[];
    updatedLog: PlaneModel[];
  }> {
    // Store references for tooltip updates
    this.tooltipUpdateService.setCurrentContext(
      previousLog,
      map,
      centerLat,
      centerLon,
      getFlagHTML
    );

    // Refresh data lists
    await this.planeDataService.refreshLists(manualUpdate);

    // Initialize map if needed
    if (!this.mapInitialized) {
      this.initializeMap(map, centerLat, centerLon);
      this.mapInitialized = true;
    }

    try {
      // Fetch aircraft data
      const aircraftData = await this.planeDataService.fetchPlaneData(
        centerLat,
        centerLon,
        radiusKm
      );

      const currentUpdateSet = new Set<string>();
      const updatedLogModels: PlaneModel[] = [];
      let anyNew = false;

      // Process each aircraft
      for (const ac of aircraftData) {
        const processedData = this.planeDataService.processAircraftData(
          ac,
          centerLat,
          centerLon,
          radiusKm,
          excludeDiscount,
          blockedPrefixes,
          this.isInitialLoad,
          getAircraftInfo
        );

        if (!processedData) continue; // Out of range or filtered

        currentUpdateSet.add(processedData.id);

        // Check if this is a new plane
        if (processedData.isNew && !processedData.isFiltered) {
          anyNew = true;
          onNewPlane();
        }

        // Create or update plane model
        const { planeModel, isExisting } =
          this.planeDataService.createOrUpdatePlaneModel(
            processedData,
            previousLog,
            centerLat,
            centerLon
          );

        // Add position to history for existing planes
        if (isExisting) {
          planeModel.addPositionToHistory(
            processedData.lat,
            processedData.lon,
            processedData.track,
            processedData.velocity,
            processedData.altitude
          );
        }

        // Handle filtered planes
        if (processedData.isFiltered) {
          if (planeModel.marker) {
            this.planeVisualizationService.removePlaneVisuals(planeModel, map);
          }
          updatedLogModels.push(planeModel);
          continue;
        }

        // Create/update marker
        const userUnit = this.settings.distanceUnit as DistanceUnit;
        const marker = this.planeVisualizationService.createPlaneMarker(
          planeModel,
          map,
          processedData.lat,
          processedData.lon,
          processedData.track ?? 0,
          processedData.altitude,
          processedData.onGround,
          processedData.isNew,
          processedData.isMilitary,
          processedData.isSpecial,
          processedData.isUnknown,
          processedData.model,
          processedData.id,
          processedData.callsign,
          getFlagHTML,
          userUnit,
          centerLat,
          centerLon
        );
        planeModel.marker = marker;

        // Update paths
        this.pathCalculationService.updatePlanePath(
          map,
          planeModel,
          processedData.lat,
          processedData.lon,
          processedData.track ?? 0,
          processedData.velocity,
          processedData.altitude,
          processedData.onGround
        );

        this.pathCalculationService.updateHistoricalTrail(
          map,
          planeModel,
          processedData.lat,
          processedData.lon,
          processedData.altitude,
          processedData.onGround
        );

        updatedLogModels.push(planeModel);
      }

      // Update new plane service
      this.planeDataService.updateNewPlaneService(currentUpdateSet);

      return {
        anyNew,
        currentIDs: Array.from(currentUpdateSet),
        updatedLog: updatedLogModels,
      };
    } catch (err) {
      console.warn('ADS-B API unavailable, using cached aircraft data:', err);
      return {
        anyNew: false,
        currentIDs: Array.from(previousLog.keys()),
        updatedLog: Array.from(previousLog.values()),
      };
    }
  }

  private initializeMap(
    map: L.Map,
    centerLat: number,
    centerLon: number
  ): void {
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
  }
}
