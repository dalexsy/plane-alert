import { Injectable, ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { CountryService } from '../country/country.service';
import { SpecialListService } from '../special-list/special-list.service';
import { ScanService } from '../scan/scan.service';
import { MilitaryPrefixService } from '../military-prefix/military-prefix.service';
import { PlaneFollowService } from '../plane-follow/plane-follow.service';
import { FollowCoordinatorService } from '../follow-coordinator/follow-coordinator.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { resetPageTitle } from './results-page-title.util';
import { ResultsOverlayFollowUiService } from './results-overlay-follow-ui.service';
import { ResultsOverlayScrollService } from './results-overlay-scroll.service';
import {
  ResultsOverlayDataService,
  ResultsLogsSnapshot,
} from './results-overlay-data.service';
import { ResultsOverlayLifecycleService } from './results-overlay-lifecycle.service';
import { ResultsOverlayActionsService } from './results-overlay-actions.service';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayFacadeCore {
  hoveredSkyPlaneIcao: string | null = null;
  hoveredSeenPlaneIcao: string | null = null;
  otherControlsHidden = false;
  now = Date.now();
  collapsed = true;
  showWindowView = true;
  showPushoverConfig = false;
  showMilitaryHistory = false;

  protected lifecycleSubs: Subscription[] = [];
  protected resultsUpdated = false;
  protected ignoreNextFilterChange = false;
  protected snapshot: ResultsLogsSnapshot = {
    skyLog: [],
    airportLog: [],
    seenLog: [],
    highlightedIcao: null,
    clickedAirports: new Set(),
    airportCircles: new Map(),
  };

  constructor(
    public settings: SettingsService,
    public countryService: CountryService,
    public followUi: ResultsOverlayFollowUiService,
    public scroll: ResultsOverlayScrollService,
    public data: ResultsOverlayDataService,
    public scanService: ScanService,
    public militaryPrefix: MilitaryPrefixService,
    public planeFollow: PlaneFollowService,
    public followCoordinator: FollowCoordinatorService,
    specialList: SpecialListService,
    protected lifecycle: ResultsOverlayLifecycleService,
    protected actions: ResultsOverlayActionsService
  ) {
    specialList.specialListUpdated$.subscribe(() => {
      this.resultsUpdated = true;
    });
  }

  getSnapshot(): ResultsLogsSnapshot {
    return this.snapshot;
  }

  markResultsUpdated(): void {
    this.resultsUpdated = true;
  }

  consumeResultsUpdated(): boolean {
    if (!this.resultsUpdated) return false;
    this.resultsUpdated = false;
    return true;
  }

  setIgnoreNextFilterChange(value: boolean): void {
    this.ignoreNextFilterChange = value;
  }

  consumeIgnoreNextFilterChange(): boolean {
    if (!this.ignoreNextFilterChange) return false;
    this.ignoreNextFilterChange = false;
    return true;
  }

  init(cdr: ChangeDetectorRef): void {
    this.lifecycleSubs = this.lifecycle.wire(this, cdr);
  }

  destroy(): void {
    this.lifecycleSubs.forEach((s) => s.unsubscribe());
    resetPageTitle();
  }

  syncInputs(
    sky: PlaneLogEntry[],
    airport: PlaneLogEntry[],
    seen: PlaneLogEntry[],
    highlighted: string | null,
    clicked: Set<number>,
    circles: Map<number, L.Circle>
  ): void {
    this.snapshot = {
      skyLog: sky,
      airportLog: airport,
      seenLog: seen,
      highlightedIcao: highlighted,
      clickedAirports: clicked,
      airportCircles: circles,
    };
    this.resultsUpdated = true;
    this.refreshFiltered();
  }

  refreshFiltered(): void {
    this.data.refreshWithCenter(
      this.snapshot,
      this.settings.lat ?? 0,
      this.settings.lon ?? 0
    );
  }

  applyPageTitle(): void {
    this.refreshFiltered();
    this.data.applyPageTitle(this.snapshot);
  }

  toggleCommercialFilter(): void {
    this.actions.toggleCommercialFilter(this);
  }

  toggleMilitaryMute(): void {
    this.followUi.toggleMilitaryMute();
  }

  toggleSeenCollapsed(onDone?: () => void): void {
    this.actions.toggleSeenCollapsed(this, onDone);
  }

  toggleCollapsed(cdr: ChangeDetectorRef): void {
    this.actions.toggleCollapsed(this, cdr);
  }

  toggleShuffle(cdr: ChangeDetectorRef): void {
    this.actions.toggleShuffle(this, cdr);
  }

  toggleNearest(cdr: ChangeDetectorRef): void {
    this.actions.toggleNearest(this, cdr);
  }

  toggleMilitaryPriority(cdr: ChangeDetectorRef): void {
    this.actions.toggleMilitaryPriority(this, cdr);
  }

  toggleOtherControls(cdr: ChangeDetectorRef): void {
    this.actions.toggleOtherControls(this, cdr);
  }

  toggleSpecial(plane: PlaneLogEntry, cdr: ChangeDetectorRef): void {
    this.actions.toggleSpecial(this, plane, cdr);
  }

  triggerNewShuffle(): void {
    this.actions.triggerNewShuffle(this);
  }

  updateScrollFade(refs: {
    sky?: HTMLElement;
    airport?: HTMLElement;
    seen?: HTMLElement;
  }): void {
    this.scroll.updateFromElements(refs);
  }
}
