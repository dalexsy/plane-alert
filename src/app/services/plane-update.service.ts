import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { PlaneFinderService } from './plane-finder.service';
import { PlaneFilterService } from './plane-filter.service';
import { AircraftDbService } from './aircraft-db.service';
import { MilitaryPrefixService } from './military-prefix.service';
import { SettingsService } from './settings.service';
import { PlaneLogService } from './plane-log.service';
import { ClosestPlaneService } from './closest-plane.service';
import { FollowService } from './follow.service';
import { LocationUpdateService } from './location-update.service';
import { PlaneModel } from '../models/plane-model';
import { CountryService } from './country.service';
import { SpecialListService } from './special-list.service';
import {
  playAlertSound,
  playHerculesAlert,
  playA400Alert,
  playA380Alert,
} from '../utils/alert-sound';
import { ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root',
})
export class PlaneUpdateService {
  constructor(
    private planeFinder: PlaneFinderService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private militaryPrefixService: MilitaryPrefixService,
    private settings: SettingsService,
    private planeLogService: PlaneLogService,
    private closestPlaneService: ClosestPlaneService,
    private followService: FollowService,
    private locationUpdateService: LocationUpdateService,
    private countryService: CountryService,
    private specialListService: SpecialListService
  ) {}

  /**
   * Find and update planes on the map
   */
  async findPlanes(
    map: L.Map,
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    planeNewTimestamps: Map<string, number>,
    activePlaneIcaos: Set<string>,
    highlightedPlaneIcao: string | null,
    followNearest: boolean,
    cdr: ChangeDetectorRef
  ): Promise<{
    updatedLog: PlaneModel[];
    anyNew: boolean;
    currentIDs: string[];
    faviconUrl: string;
  }> {
    // Check for auto-location updates if enabled
    if (this.settings.useAutoLocation) {
      this.locationUpdateService.checkAutoLocationUpdate((lat, lon, radius) => {
        // This would need to be handled by the component since it requires updateMap
        // For now, we'll keep this logic in the component
      });
    }

    const previousPlaneKeys = new Set(planeLog.keys());
    const lat = this.settings.lat ?? 52.3667;
    const lon = this.settings.lon ?? 13.5033;
    const radius = this.settings.radius ?? 5;
    const exclude = this.settings.excludeDiscount;

    const result = await this.planeFinder.findPlanes(
      map,
      lat,
      lon,
      radius,
      exclude,
      this.planeFilter.getFilterPrefixes(),
      planeNewTimestamps,
      (origin) => this.countryService.getFlagHTML(origin),
      false, // manualUpdate - will be passed from component
      () => {}, // onProgress callback
      (icao) => {
        const record = this.aircraftDb.lookup(icao);
        return record
          ? { model: record.model, ownop: record.ownop, mil: record.mil }
          : null;
      },
      planeLog as Map<string, PlaneModel>,
      highlightedPlaneIcao,
      followNearest
    );

    const { anyNew, currentIDs, updatedLog } = result;

    // Update favicon based on special/military planes
    const faviconUrl = this.getFaviconUrl(updatedLog);

    // Process and update plane models
    const updatedPlaneModels = this.processPlaneModels(
      updatedLog,
      previousPlaneKeys,
      exclude
    );

    // Play alert sounds for new planes (after isNew flags are correctly set)
    this.playAlertsForNewPlanes(updatedPlaneModels, exclude);

    // Update plane visuals and logs
    this.updatePlaneLogsAndVisuals(
      updatedPlaneModels,
      planeLog,
      activePlaneIcaos,
      highlightedPlaneIcao,
      map
    );

    // CRITICAL: Update plane logs for UI components AFTER planes are fetched
    this.planeLogService.updatePlaneLog(Array.from(planeLog.values()));

    // Update closest plane data
    this.closestPlaneService.computeClosestPlane(
      planeLog,
      highlightedPlaneIcao
    );
    const closestData = this.closestPlaneService.getClosestPlaneData();

    // Track followed plane
    this.followService.trackFollowedPlane(planeLog, highlightedPlaneIcao, map);

    // Reapply tooltip highlight if needed
    this.reapplyTooltipHighlight(highlightedPlaneIcao, planeLog);

    cdr.detectChanges();

    return { updatedLog: updatedPlaneModels, anyNew, currentIDs, faviconUrl };
  }

  private getFaviconUrl(updatedLog: PlaneModel[]): string {
    const hasSpecial = updatedLog.some((p) =>
      this.specialListService.isSpecial(p.icao)
    );
    const hasMil = updatedLog.some(
      (p) => !!this.aircraftDb.lookup(p.icao)?.mil
    );
    return hasSpecial
      ? 'assets/favicon/special/favicon.ico'
      : hasMil
      ? 'assets/favicon/military/favicon.ico'
      : 'assets/favicon/favicon.ico';
  }

  private playAlertsForNewPlanes(
    updatedLog: PlaneModel[],
    exclude: boolean
  ): void {
    const newVisible = updatedLog.filter((p) => p.isNew && !p.filteredOut);

    // Determine what types of new planes we have
    const hasHercules = newVisible.some((p) =>
      p.model?.toLowerCase().includes('hercules')
    );
    const hasA400 = newVisible.some((p) =>
      p.model?.toLowerCase().includes('a400')
    );
    const hasA380 = newVisible.some((p) => p.model?.match(/a\s*-?\s*380/i));
    const hasAlertPlanes = newVisible.some(
      (p) =>
        this.aircraftDb.lookup(p.icao)?.mil ||
        this.specialListService.isSpecial(p.icao)
    );

    // Play only one alert sound per scan, prioritizing specific aircraft types
    if (!this.settings.militaryMute) {
      if (hasHercules) {
        playHerculesAlert();
      } else if (hasA400) {
        playA400Alert();
      } else if (hasA380) {
        playA380Alert();
      } else if (hasAlertPlanes) {
        playAlertSound();
      }
    }
  }

  private processPlaneModels(
    updatedLog: PlaneModel[],
    previousPlaneKeys: Set<string>,
    exclude: boolean
  ): PlaneModel[] {
    const isPlaneModel = (p: any): p is PlaneModel =>
      p && typeof p.updateFrom === 'function';

    return updatedLog.map((p) => {
      const planeModel = isPlaneModel(p) ? p : new PlaneModel(p);

      // If it's in planeLog from the previous scan, it's not new now
      planeModel.isNew = !previousPlaneKeys.has(planeModel.icao);

      // Determine military status
      const dbMil = this.aircraftDb.lookup(planeModel.icao)?.mil || false;
      const prefixMil = this.militaryPrefixService.isMilitaryCallsign(
        planeModel.callsign
      );
      const isMilitary = dbMil || prefixMil;
      planeModel.isMilitary = isMilitary;

      planeModel.filteredOut = !this.planeFilter.shouldIncludeCallsign(
        planeModel.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        isMilitary
      );

      return planeModel;
    });
  }

  private updatePlaneLogsAndVisuals(
    updatedPlaneModels: PlaneModel[],
    planeLog: Map<string, PlaneModel>,
    activePlaneIcaos: Set<string>,
    highlightedPlaneIcao: string | null,
    map: L.Map
  ): void {
    // Remove planes that are no longer in range
    for (const [id, plane] of planeLog.entries()) {
      if (!updatedPlaneModels.some((p) => p.icao === id)) {
        plane.removeVisuals(map);
        planeLog.delete(id);
      }
    }

    // Update logs with new plane data
    for (const planeModel of updatedPlaneModels) {
      planeLog.set(planeModel.icao, planeModel);
    }

    // Update active ICAOs
    activePlaneIcaos.clear();
    for (const icao of planeLog.keys()) {
      activePlaneIcaos.add(icao);
    }
  }

  private reapplyTooltipHighlight(
    highlightedPlaneIcao: string | null,
    planeLog: Map<string, PlaneModel>
  ): void {
    if (highlightedPlaneIcao) {
      const pm = planeLog.get(highlightedPlaneIcao);
      const tooltipEl = pm?.marker?.getTooltip()?.getElement();
      tooltipEl?.classList.add('highlighted-tooltip');
    }
  }
}
