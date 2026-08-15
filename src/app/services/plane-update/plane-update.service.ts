import { Injectable } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { PlaneFinderService } from '../plane-finder/plane-finder.service';
import { PlaneFilterService } from '../plane-filter/plane-filter.service';
import { AircraftDbService } from '../aircraft-db/aircraft-db.service';
import { MilitaryPrefixService } from '../military-prefix/military-prefix.service';
import { SettingsService } from '../settings/settings.service';
import { PlaneLogService } from '../plane-log/plane-log.service';
import { ClosestPlaneService } from '../closest-plane/closest-plane.service';
import { FollowService } from '../follow/follow.service';
import { LocationUpdateService } from '../location-update/location-update.service';
import { PlaneModel } from '../../models/plane-model';
import { CountryService } from '../country/country.service';
import { SpecialListService } from '../special-list/special-list.service';
import * as L from 'leaflet';
import {
  getFaviconUrlForPlanes,
  playAlertsForNewPlanes,
  processPlaneModels,
  reapplyTooltipHighlight,
  updatePlaneLogsAndVisuals,
} from './plane-update-processing.util';
import {
  loadSeenIcaosFromSession,
  saveSeenIcaosToSession,
} from '../../utils/seen-icao-session/seen-icao-session.util';

@Injectable({ providedIn: 'root' })
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
    private specialListService: SpecialListService,
  ) {}

  async findPlanes(
    map: L.Map,
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    planeNewTimestamps: Map<string, number>,
    activePlaneIcaos: Set<string>,
    highlightedPlaneIcao: string | null,
    followNearest: boolean,
    cdr: ChangeDetectorRef,
  ): Promise<{
    updatedLog: PlaneModel[];
    anyNew: boolean;
    currentIDs: string[];
    faviconUrl: string;
  }> {
    if (this.settings.useAutoLocation) {
      this.locationUpdateService.checkAutoLocationUpdate(() => undefined);
    }

    // Seed from localStorage every scan so a one-poll ADS-B gap (plane dropped
    // from planeLog) does not mark the same mil as isNew and re-fire MP3s.
    const previousPlaneKeys = new Set(planeLog.keys());
    for (const icao of loadSeenIcaosFromSession()) {
      previousPlaneKeys.add(icao);
    }
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
      false,
      () => undefined,
      (icao) => {
        const record = this.aircraftDb.lookup(icao);
        return record
          ? { model: record.model, ownop: record.ownop, mil: record.mil }
          : null;
      },
      planeLog as Map<string, PlaneModel>,
      highlightedPlaneIcao,
      followNearest,
    );

    const { anyNew, currentIDs, updatedLog } = result;
    const faviconUrl = getFaviconUrlForPlanes(this, updatedLog);
    const updatedPlaneModels = processPlaneModels(
      this,
      updatedLog,
      previousPlaneKeys,
      exclude,
    );

    playAlertsForNewPlanes(this, updatedPlaneModels, exclude);
    updatePlaneLogsAndVisuals(
      updatedPlaneModels,
      planeLog,
      activePlaneIcaos,
      map,
    );
    saveSeenIcaosToSession(planeLog.keys());

    this.planeLogService.updatePlaneLog(Array.from(planeLog.values()));
    this.closestPlaneService.computeClosestPlane(planeLog, highlightedPlaneIcao);
    this.followService.trackFollowedPlane(planeLog, highlightedPlaneIcao, map);
    reapplyTooltipHighlight(highlightedPlaneIcao, planeLog);
    cdr.detectChanges();

    return { updatedLog: updatedPlaneModels, anyNew, currentIDs, faviconUrl };
  }
}
