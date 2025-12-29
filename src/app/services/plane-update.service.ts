import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { PlaneFinderService } from './plane-finder.service';
import { PlaneFilterService } from './plane-filter.service';
import { AircraftDbService } from './aircraft-db.service';
import { SettingsService } from './settings.service';
import { looksMilitary } from '@plane-alert/shared';
import { PlaneLogService } from './plane-log.service';
import { ClosestPlaneService } from './closest-plane.service';
import { FollowService } from './follow.service';
import { LocationUpdateService } from './location-update.service';
import { PlaneModel } from '../models/plane-model';
import { CountryService } from './country.service';
import { SpecialListService } from './special-list.service';
import { NotificationService } from './notification.service';
import { TooltipUpdateService } from './tooltip-update.service';
import { haversineDistance } from '../utils/geo-utils';
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
    private settings: SettingsService,
    private planeLogService: PlaneLogService,
    private closestPlaneService: ClosestPlaneService,
    private followService: FollowService,
    private locationUpdateService: LocationUpdateService,
    private countryService: CountryService,
    private specialListService: SpecialListService,
    private notificationService: NotificationService,
    private tooltipUpdateService: TooltipUpdateService
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
    const hasSpecial = updatedLog.some((p) => p.isSpecial === true);
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
    const hasA400 = newVisible.some((p) => p.model?.match(/a\s*-?\s*400/i));
    const hasA380 = newVisible.some((p) => p.model?.match(/a\s*-?\s*380/i));
    const hasAlertPlanes = newVisible.some(
      (p) => this.aircraftDb.lookup(p.icao)?.mil || p.isSpecial === true
    );

    // Get military planes for notifications
    const militaryPlanes = newVisible.filter(
      (p) => this.aircraftDb.lookup(p.icao)?.mil
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

    // Show notifications for military planes
    militaryPlanes.forEach((plane) => {
      const record = this.aircraftDb.lookup(plane.icao);
      const modelLabel = plane.model?.trim() || record?.model || undefined;
      this.notificationService.showMilitaryPlaneNotification({
        icao: plane.icao,
        callsign: plane.callsign,
        model: modelLabel,
        operator: record?.ownop,
        altitude: plane.altitude || undefined,
        speed: plane.velocity || undefined,
        direction: plane.cardinal,
        distanceKm: plane.distanceKm,
        origin: plane.origin,
        verticalRate: plane.verticalRate || undefined,
      });
    });
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

      // Fresh updates are not stale
      planeModel.isStale = false;

      // If it's in planeLog from the previous scan, it's not new now
      planeModel.isNew = !previousPlaneKeys.has(planeModel.icao);

      // Determine military status using shared looksMilitary() function
      // Note: PlaneModel doesn't have mil/dbFlags, so we keep legacy logic for now
      const dbMil = this.aircraftDb.lookup(planeModel.icao)?.mil || false;
      planeModel.isMilitary = dbMil;

      planeModel.filteredOut = !this.planeFilter.shouldIncludeCallsign(
        planeModel.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        planeModel.isMilitary
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
    const STALE_TTL_MS = 5 * 60 * 1000;
    const now = Date.now();
    const centerLat = this.settings.lat ?? 52.3667;
    const centerLon = this.settings.lon ?? 13.5033;
    const radiusKm = this.settings.radius ?? 5;

    // Remove planes that are no longer in range
    for (const [id, plane] of planeLog.entries()) {
      if (!updatedPlaneModels.some((p) => p.icao === id)) {
        // If a plane is clearly outside the current search radius, remove it immediately.
        // "Stale" is only useful for smoothing brief dropouts near the current area;
        // it should never keep planes from a different location visible.
        if (plane.lat != null && plane.lon != null) {
          const distKm = haversineDistance(
            centerLat,
            centerLon,
            plane.lat,
            plane.lon
          );
          if (distKm > radiusKm) {
            plane.removeVisuals(map);
            planeLog.delete(id);
            continue;
          }
        }

        const lastSeenTs =
          plane.positionHistory && plane.positionHistory.length > 0
            ? plane.positionHistory[plane.positionHistory.length - 1].timestamp
            : plane.firstSeen;

        if (now - lastSeenTs <= STALE_TTL_MS) {
          if (plane.isStale !== true) {
            plane.isStale = true;
            this.tooltipUpdateService.updateTooltipForPlaneNow(plane);
          }
          continue;
        }

        plane.removeVisuals(map);
        planeLog.delete(id);
      }
    }

    // Update logs with new plane data
    for (const planeModel of updatedPlaneModels) {
      const wasStale = planeLog.get(planeModel.icao)?.isStale === true;
      planeModel.isStale = false;
      planeLog.set(planeModel.icao, planeModel);

      if (wasStale) {
        this.tooltipUpdateService.updateTooltipForPlaneNow(planeModel);
      }
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
