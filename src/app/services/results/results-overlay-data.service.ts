import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { CountryService } from '../country/country.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import {
  buildPlaneComparator,
  filterAndSortPlanes,
  clearExpiredNewFlags,
  planeListHash,
} from './results-list-filter.util';
import {
  getTopPriorityPlane,
  updateResultsPageTitle,
} from './results-page-title.util';
import { ResultsOverlayFollowUiService } from './results-overlay-follow-ui.service';

export interface ResultsLogsSnapshot {
  skyLog: PlaneLogEntry[];
  airportLog: PlaneLogEntry[];
  seenLog: PlaneLogEntry[];
  highlightedIcao: string | null;
  clickedAirports: Set<number>;
  airportCircles: Map<number, L.Circle>;
}

@Injectable({ providedIn: 'root' })
export class ResultsOverlayDataService {
  filteredSkyPlaneLog: PlaneLogEntry[] = [];
  filteredAirportPlaneLog: PlaneLogEntry[] = [];
  filteredSeenPlaneLog: PlaneLogEntry[] = [];
  private lastTitleHash = '';
  private lastSkyHash = '';
  private lastAirportHash = '';

  constructor(
    private countryService: CountryService,
    private followUi: ResultsOverlayFollowUiService
  ) {}

  refreshWithCenter(
    snapshot: ResultsLogsSnapshot,
    centerLat: number,
    centerLon: number
  ): void {
    const cmp = buildPlaneComparator(
      centerLat,
      centerLon,
      this.followUi.militaryPriority,
      snapshot.clickedAirports,
      snapshot.airportCircles
    );
    this.filteredSkyPlaneLog = filterAndSortPlanes(
      snapshot.skyLog,
      cmp,
      snapshot.highlightedIcao
    );
    this.filteredAirportPlaneLog = [];
    this.filteredSeenPlaneLog = filterAndSortPlanes(snapshot.seenLog, cmp, null);
    clearExpiredNewFlags(
      [
        ...this.filteredSkyPlaneLog,
        ...this.filteredAirportPlaneLog,
        ...this.filteredSeenPlaneLog,
      ],
      Date.now()
    );
  }

  applyPageTitle(snapshot: ResultsLogsSnapshot): void {
    const top = getTopPriorityPlane(
      this.filteredSkyPlaneLog,
      this.filteredAirportPlaneLog
    );
    const { hash, title } = updateResultsPageTitle(
      this.countryService,
      top,
      this.lastTitleHash
    );
    if (hash !== this.lastTitleHash) {
      this.lastTitleHash = hash;
      document.title = title;
    }
    this.lastSkyHash = planeListHash(snapshot.skyLog);
    this.lastAirportHash = planeListHash(snapshot.airportLog);
  }

  titleInputsChanged(snapshot: ResultsLogsSnapshot): boolean {
    const skyHash = planeListHash(snapshot.skyLog);
    const airportHash = planeListHash(snapshot.airportLog);
    if (skyHash === this.lastSkyHash && airportHash === this.lastAirportHash) {
      return false;
    }
    this.lastSkyHash = skyHash;
    this.lastAirportHash = airportHash;
    return true;
  }
}
