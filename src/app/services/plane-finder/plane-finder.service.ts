import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { SettingsService } from '../settings/settings.service';
import { PlaneDataService } from '../plane-data/plane-data.service';
import { PathCalculationService } from '../path-calculation/path-calculation.service';
import { PlaneVisualizationService } from '../plane-visualization/plane-visualization.service';
import { TooltipUpdateService } from '../tooltip-update/tooltip-update.service';
import {
  processPlaneFinderAircraft,
  wirePlaneFinderMap,
} from './plane-finder-process.util';

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
      wirePlaneFinderMap(map, centerLat, centerLon, this.settings);
      this.mapInitialized = true;
    }

    try {
      const aircraftData = await this.planeDataService.fetchPlaneData(
        centerLat,
        centerLon,
        radiusKm
      );

      return processPlaneFinderAircraft({
        aircraftData,
        map,
        centerLat,
        centerLon,
        radiusKm,
        excludeDiscount,
        blockedPrefixes,
        isInitialLoad: this.isInitialLoad,
        getAircraftInfo,
        previousLog,
        onNewPlane,
        getFlagHTML,
        planeDataService: this.planeDataService,
        planeVisualizationService: this.planeVisualizationService,
        pathCalculationService: this.pathCalculationService,
        settings: this.settings,
      });
    } catch (err) {
      console.warn('ADS-B API unavailable, using cached aircraft data:', err);
      return {
        anyNew: false,
        currentIDs: Array.from(previousLog.keys()),
        updatedLog: Array.from(previousLog.values()),
      };
    }
  }
}
