import { Injectable, ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { interval, Subscription } from 'rxjs';
import { SettingsService } from '../settings.service';
import { CountryService } from '../country.service';
import { SpecialListService } from '../special-list.service';
import { ScanService } from '../scan.service';
import { MilitaryPrefixService } from '../military-prefix.service';
import { PlaneFollowService } from '../plane-follow.service';
import { FollowCoordinatorService } from '../follow-coordinator.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { resetPageTitle } from './results-page-title.util';
import { ResultsOverlayFollowUiService } from './results-overlay-follow-ui.service';
import { ResultsOverlayScrollService } from './results-overlay-scroll.service';
import {
  ResultsOverlayDataService,
  ResultsLogsSnapshot,
} from './results-overlay-data.service';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayFacadeService {
  hoveredSkyPlaneIcao: string | null = null;
  hoveredSeenPlaneIcao: string | null = null;
  otherControlsHidden = false;
  now = Date.now();
  collapsed = true;
  showWindowView = true;
  showPushoverConfig = false;

  private refreshSub?: Subscription;
  private scanSub?: Subscription;
  private followStateSub?: Subscription;
  private resultsUpdated = false;
  private ignoreNextFilterChange = false;
  private snapshot: ResultsLogsSnapshot = {
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
    private specialList: SpecialListService,
    private scanService: ScanService,
    private militaryPrefix: MilitaryPrefixService,
    private planeFollow: PlaneFollowService,
    private followCoordinator: FollowCoordinatorService
  ) {
    this.specialList.specialListUpdated$.subscribe(() => {
      this.resultsUpdated = true;
    });
  }

  get filteredSkyPlaneLog(): PlaneLogEntry[] {
    return this.data.filteredSkyPlaneLog;
  }

  get filteredSeenPlaneLog(): PlaneLogEntry[] {
    return this.data.filteredSeenPlaneLog;
  }

  get shuffleMode(): boolean {
    return this.followUi.shuffleMode;
  }

  get nearestMode(): boolean {
    return this.followUi.nearestMode;
  }

  get militaryPriority(): boolean {
    return this.followUi.militaryPriority;
  }

  get skyListScrollable(): boolean {
    return this.scroll.sky.scrollable;
  }

  get skyListAtBottom(): boolean {
    return this.scroll.sky.atBottom;
  }

  set skyListAtBottom(v: boolean) {
    this.scroll.sky.atBottom = v;
  }

  get seenListScrollable(): boolean {
    return this.scroll.seen.scrollable;
  }

  get seenListAtBottom(): boolean {
    return this.scroll.seen.atBottom;
  }

  set seenListAtBottom(v: boolean) {
    this.scroll.seen.atBottom = v;
  }

  init(cdr: ChangeDetectorRef): void {
    this.otherControlsHidden = this.settings.resultsOverlayControlsHidden;
    this.settings.resultsOverlayControlsChanged.subscribe((v) => {
      this.otherControlsHidden = v;
      cdr.markForCheck();
    });
    this.collapsed = this.settings.resultsOverlayCollapsed;
    this.militaryPrefix.loadPrefixes().then(() => {
      this.resultsUpdated = true;
    });
    this.refreshSub = interval(1000).subscribe(() => {
      this.now = Date.now();
      this.refreshFiltered();
      if (this.resultsUpdated) {
        this.applyPageTitle();
        this.resultsUpdated = false;
      } else if (this.data.titleInputsChanged(this.snapshot)) {
        this.applyPageTitle();
      }
    });
    let prev = 0;
    this.scanSub = this.scanService.countdown$.subscribe((count) => {
      if (count > prev && prev !== 0) this.resultsUpdated = true;
      prev = count;
    });
    this.settings.excludeDiscountChanged.subscribe(() => {
      if (this.ignoreNextFilterChange) {
        this.ignoreNextFilterChange = false;
        return;
      }
      this.resultsUpdated = true;
    });
    this.resultsUpdated = true;
    this.followStateSub = this.planeFollow.followState$.subscribe(() => {
      const m = this.followCoordinator.getCurrentModes();
      this.followUi.syncModes(m.shuffle, m.nearest);
      cdr.detectChanges();
    });
  }

  destroy(): void {
    this.refreshSub?.unsubscribe();
    this.scanSub?.unsubscribe();
    this.followStateSub?.unsubscribe();
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

  get militaryMute(): boolean {
    return this.settings.militaryMute;
  }

  get seenCollapsed(): boolean {
    return this.settings.seenCollapsed;
  }

  get militaryCount(): number {
    return this.data.filteredSkyPlaneLog.filter((p) => p.isMilitary).length;
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
    this.ignoreNextFilterChange = true;
    this.followUi.toggleCommercialFilter(() => {
      this.resultsUpdated = true;
    });
  }

  toggleMilitaryMute(): void {
    this.followUi.toggleMilitaryMute();
  }

  toggleSeenCollapsed(onDone?: () => void): void {
    this.settings.setSeenCollapsed(!this.settings.seenCollapsed);
    onDone?.();
  }

  toggleCollapsed(cdr: ChangeDetectorRef): void {
    this.collapsed = !this.collapsed;
    this.settings.setResultsOverlayCollapsed(this.collapsed);
    cdr.detectChanges();
  }

  toggleShuffle(cdr: ChangeDetectorRef): void {
    this.followUi.toggleShuffle(this.data.filteredSkyPlaneLog, cdr);
  }

  toggleNearest(cdr: ChangeDetectorRef): void {
    this.followUi.toggleNearest(this.data.filteredSkyPlaneLog, cdr);
  }

  toggleMilitaryPriority(cdr: ChangeDetectorRef): void {
    this.followUi.toggleMilitaryPriority(
      this.data.filteredSkyPlaneLog,
      () => {
        this.resultsUpdated = true;
        this.refreshFiltered();
      },
      cdr
    );
  }

  toggleOtherControls(cdr: ChangeDetectorRef): void {
    this.otherControlsHidden = !this.otherControlsHidden;
    this.settings.setResultsOverlayControlsHidden(this.otherControlsHidden);
    if (!this.otherControlsHidden && this.collapsed) this.toggleCollapsed(cdr);
    else if (this.otherControlsHidden && !this.collapsed) this.toggleCollapsed(cdr);
    cdr.markForCheck();
  }

  toggleSpecial(plane: PlaneLogEntry, cdr: ChangeDetectorRef): void {
    plane.isSpecial = !plane.isSpecial;
    this.specialList.toggleSpecial(plane.icao);
    cdr.markForCheck();
  }

  triggerNewShuffle(): void {
    this.followUi.triggerNewShuffle(
      this.snapshot.highlightedIcao,
      this.data.filteredSkyPlaneLog
    );
  }

  updateScrollFade(refs: {
    sky?: HTMLElement;
    airport?: HTMLElement;
    seen?: HTMLElement;
  }): void {
    this.scroll.updateFromElements(refs);
  }
}
