// src/app/components/results-overlay/results-overlay.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  AfterViewChecked,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SettingsService } from '../../services/settings.service';
import { ButtonComponent } from '../ui/button.component';
import { interval, Subscription } from 'rxjs';
import { AircraftDbService } from '../../services/aircraft-db.service';
import { ScanService } from '../../services/scan.service';
import { SpecialListService } from '../../services/special-list.service';
import { haversineDistance } from '../../utils/geo-utils';

export interface PlaneLogEntry {
  callsign: string;
  origin: string;
  firstSeen: number;
  model?: string;
  operator?: string;
  bearing?: number;
  cardinal?: string;
  arrow?: string;
  isNew?: boolean;
  lat?: number;
  lon?: number;
  filteredOut?: boolean;
  icao: string;
  isMilitary?: boolean; // Add this property to indicate if the plane is military
  isSpecial?: boolean; // Add special plane flag
}

@Component({
  selector: 'app-results-overlay',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './results-overlay.component.html',
  styleUrls: ['./results-overlay.component.scss'],
})
export class ResultsOverlayComponent
  implements OnInit, OnChanges, OnDestroy, AfterViewInit, AfterViewChecked
{
  // track hover state for special toggle
  hoveredPlaneIcao: string | null = null;
  // Controls collapse state for 'All Planes Peeped'
  get seenCollapsed(): boolean {
    return this.settings.seenCollapsed;
  }

  @Input() skyPlaneLog: PlaneLogEntry[] = [];
  // refs to scrollable lists for fade handling
  @ViewChild('skyList') skyListRef!: ElementRef<HTMLDivElement>;
  @ViewChild('airportList') airportListRef!: ElementRef<HTMLDivElement>;
  @ViewChild('seenList') seenListRef!: ElementRef<HTMLDivElement>;
  @Input() airportPlaneLog: PlaneLogEntry[] = [];
  @Input() seenPlaneLog: PlaneLogEntry[] = [];
  @Input() loadingAirports: boolean = false;
  // scroll state flags
  skyListScrollable = false;
  skyListAtBottom = false;
  airportListScrollable = false;
  airportListAtBottom = false;
  seenListScrollable = false;
  seenListAtBottom = false;
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() exportFilterList = new EventEmitter<void>();
  @Output() clearHistoricalList = new EventEmitter<void>();

  // Filtered versions of the plane logs
  filteredSkyPlaneLog: PlaneLogEntry[] = [];
  filteredAirportPlaneLog: PlaneLogEntry[] = [];
  filteredSeenPlaneLog: PlaneLogEntry[] = [];

  now = Date.now();
  refreshSub!: Subscription;
  private scanSub!: Subscription;
  private baseTitle: string = 'Plane Alert';
  private emptyTitle: string = 'Nothing peepworthy. - Plane Alert';
  private lastTitleUpdateHash: string = '';
  // Track the last known plane lists for change detection
  private lastSkyPlaneHash: string = '';
  private lastAirportPlaneHash: string = '';
  private resultsUpdated: boolean = false;
  // Flag to prevent duplicate event handling
  private ignoreNextFilterChange = false;

  // Debouncing for button clicks
  private lastToggleTime = 0;
  private readonly DEBOUNCE_TIME = 500; // ms

  // commercialMute now backed by SettingsService
  get commercialMute(): boolean {
    return this.settings.commercialMute;
  }

  private NEW_PLANE_MINUTES = 1; // Plane is 'new' for 1 minute

  constructor(
    public countryService: CountryService,
    public planeFilter: PlaneFilterService,
    public settings: SettingsService,
    private aircraftDb: AircraftDbService,
    private scanService: ScanService,
    private specialListService: SpecialListService
  ) {
    // react to custom special list changes
    this.specialListService.specialListUpdated$.subscribe(() => {
      this.resultsUpdated = true;
    });
  }

  ngOnInit(): void {
    // commercialMute is loaded by SettingsService.load()
    // Collapse state already loaded by SettingsService.load()
    // Just update the time every second
    this.refreshSub = interval(1000).subscribe(() => {
      this.now = Date.now();
      this.sortLogs();
      this.updateFilteredLogs();

      // Check if plane lists have changed during sort
      this.checkForResultsUpdates();
    });

    // Listen for scan countdown (no debug logs)
    let previousCount = 0;
    this.scanSub = this.scanService.countdown$.subscribe((count) => {
      if (count > previousCount && previousCount !== 0) {
        this.resultsUpdated = true;
      }
      previousCount = count;
    });

    // Log initial special list loaded from service
    console.log(
      '[ResultsOverlay] initial specials:',
      this.specialListService.getAllSpecialIcaos()
    );

    // Listen for commercial filter changes via the settings service
    this.settings.excludeDiscountChanged.subscribe(() => {
      if (this.ignoreNextFilterChange) {
        // Skip this event as we've already handled it locally
        this.ignoreNextFilterChange = false;
        return;
      }

      this.resultsUpdated = true;
    });

    // Handle initial page load
    this.resultsUpdated = true;
  }

  ngAfterViewInit(): void {
    // Update logs and title immediately on initial page load
    this.updateFilteredLogs();
    this.updatePageTitle();
    // ensure fade states set after view init
    setTimeout(() => this.updateScrollFadeStates(), 0);
  }

  ngAfterViewChecked(): void {
    this.updateScrollFadeStates();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When input plane lists change
    if (changes['skyPlaneLog'] || changes['airportPlaneLog']) {
      this.resultsUpdated = true;
      this.updateFilteredLogs();
    }
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.scanSub?.unsubscribe();
    document.title = this.baseTitle;
  }

  getTimeAgo(timestamp: number): string {
    const diff = Math.floor((this.now - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(minutes / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ${minutes % 60}m ago`;
  }

  onFilter(plane: PlaneLogEntry): void {
    this.filterPrefix.emit(plane);
    // Update title after filter changes
    // No longer immediately updating filtered logs here, relying on parent component update
    // setTimeout(() => {
    //   this.updateFilteredLogs();
    //   this.updatePageTitle();
    // }, 100); // Small delay to let filter apply
  }

  onExportList(): void {
    this.exportFilterList.emit();
  }

  onClearHistoricalList(): void {
    this.clearHistoricalList.emit();
  }

  /**
   * Handle toggling the commercial filter with a button
   */
  onToggleCommercialFilter(): void {
    // Simple debouncing - prevent multiple clicks within 500ms
    const now = Date.now();
    if (now - this.lastToggleTime < this.DEBOUNCE_TIME) {
      return;
    }
    this.lastToggleTime = now;

    // Get the current value before changing it
    const currentValue = this.settings.excludeDiscount;

    // Set a flag to ignore the next event from the settings service
    this.ignoreNextFilterChange = true;

    // Toggle the current value
    this.settings.setExcludeDiscount(!currentValue);

    // Update local state
    this.resultsUpdated = true;
  }

  /**
   * Handle toggling the commercial filter from checkbox (legacy method)
   */
  onExcludeCommercialChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settings.setExcludeDiscount(checked);
    this.resultsUpdated = true;
  }

  /**
   * Toggle muting alert sound for commercial-only results
   */
  onToggleCommercialMute(): void {
    // Toggle and persist commercial mute through settings service
    this.settings.setCommercialMute(!this.settings.commercialMute);
  }

  /**
   * Returns true if only commercial planes are found (no military in sky or airport)
   */
  get onlyCommercial(): boolean {
    return (
      this.filteredSkyPlaneLog.concat(this.filteredAirportPlaneLog).length >
        0 &&
      this.filteredSkyPlaneLog
        .concat(this.filteredAirportPlaneLog)
        .every((p) => !p.isMilitary)
    );
  }

  /** Toggle collapse/expand of the seen planes list */
  toggleSeenCollapsed(): void {
    this.settings.setSeenCollapsed(!this.settings.seenCollapsed);
    // recalc fade overlay once seen list panel toggles
    setTimeout(() => this.updateScrollFadeStates(), 0);
  }

  // Updates the filtered versions of the plane logs
  private updateFilteredLogs(): void {
    this.filteredSkyPlaneLog = this.skyPlaneLog.filter(
      (plane) => !plane.filteredOut
    );
    // Exclude airport planes over 300km from settings center
    const centerLat = this.settings.lat ?? 0;
    const centerLon = this.settings.lon ?? 0;
    this.filteredAirportPlaneLog = this.airportPlaneLog.filter(
      (plane) =>
        !plane.filteredOut &&
        plane.lat != null &&
        plane.lon != null &&
        haversineDistance(centerLat, centerLon, plane.lat, plane.lon) <= 300
    );
    this.filteredSeenPlaneLog = this.seenPlaneLog.filter(
      (plane) => !plane.filteredOut
    );

    // Clear isNew if plane is older than NEW_PLANE_MINUTES
    const now = Date.now();
    for (const plane of [
      ...this.filteredSkyPlaneLog,
      ...this.filteredAirportPlaneLog,
      ...this.filteredSeenPlaneLog,
    ]) {
      if (
        plane.isNew &&
        now - plane.firstSeen > this.NEW_PLANE_MINUTES * 60 * 1000
      ) {
        plane.isNew = false;
      }
    }
    // recalc fade state: hide gradient if not scrollable or already at bottom
    setTimeout(() => this.updateScrollFadeStates(), 0);
  }

  private setMilitaryFlag(planes: PlaneLogEntry[]): void {
    planes.forEach((plane) => {
      const record = this.aircraftDb.lookup(plane.icao);
      plane.isMilitary = record?.mil || false; // Set isMilitary based on the database flag
    });
  }

  private unifyNewFlags(): void {
    const skyMap = new Map(this.skyPlaneLog.map((p) => [p.icao, p.isNew]));
    // Match seen-plane with whatever sky-plane currently has
    this.seenPlaneLog.forEach((plane) => {
      const newFlag = skyMap.get(plane.icao);
      if (typeof newFlag === 'boolean') {
        plane.isNew = newFlag;
      }
    });
  }

  private sortLogs(): void {
    this.setMilitaryFlag(this.skyPlaneLog);
    this.setMilitaryFlag(this.airportPlaneLog);
    this.setMilitaryFlag(this.seenPlaneLog);
    // set special flags from persistent service
    this.setSpecialFlag(this.skyPlaneLog);
    this.setSpecialFlag(this.airportPlaneLog);
    this.setSpecialFlag(this.seenPlaneLog);

    // More comprehensive sorting function that:
    // 1. Military planes always at the top
    // 2. Then sort by time seen (most recent first)
    // 3. Within the same time frame (e.g., minutes), new planes first
    // 4. Finally sort alphabetically by callsign or ICAO for stable order
    const sortPlanes = (a: PlaneLogEntry, b: PlaneLogEntry) => {
      // Military planes always first (ONLY military planes, not helicopters)
      if (a.isMilitary !== b.isMilitary) {
        return a.isMilitary ? -1 : 1;
      }
      // Special planes always next
      if (a.isSpecial !== b.isSpecial) {
        return a.isSpecial ? -1 : 1;
      }
      // Then prioritize new planes over older ones
      if (a.isNew !== b.isNew) {
        return a.isNew ? -1 : 1;
      }

      // Next prioritize planes that have an operator
      const aHasOperator = !!a.operator;
      const bHasOperator = !!b.operator;
      if (aHasOperator !== bHasOperator) {
        return aHasOperator ? -1 : 1;
      }
      // Then prioritize planes that have a model
      const aHasModel = !!a.model;
      const bHasModel = !!b.model;
      if (aHasModel !== bHasModel) {
        return aHasModel ? -1 : 1;
      }

      // Calculate time buckets (in minutes) for better comparison
      const aMinutes = Math.floor((this.now - a.firstSeen) / (60 * 1000));
      const bMinutes = Math.floor((this.now - b.firstSeen) / (60 * 1000));

      // Sort by time bucket first (most recent first)
      if (aMinutes !== bMinutes) {
        return aMinutes - bMinutes;
      }

      // For planes with identical time buckets and newness, sort by exact timestamp
      if (a.firstSeen !== b.firstSeen) {
        return b.firstSeen - a.firstSeen;
      }

      // Prefer planes with a callsign (non-empty) over empty
      const aHasCallsign = !!(a.callsign && a.callsign.trim().length > 0);
      const bHasCallsign = !!(b.callsign && b.callsign.trim().length > 0);
      if (aHasCallsign !== bHasCallsign) {
        return aHasCallsign ? -1 : 1;
      }

      // Alphabetically by callsign (empty callsigns sort last)
      if ((a.callsign || '') !== (b.callsign || '')) {
        return (a.callsign || '').localeCompare(b.callsign || '');
      }

      // Use ICAO as a final tie-breaker
      return a.icao.localeCompare(b.icao);
    };

    this.skyPlaneLog.sort(sortPlanes);
    this.airportPlaneLog.sort(sortPlanes);
    this.seenPlaneLog.sort(sortPlanes);

    // Ensure isNew stays consistent with the sky-plane list
    this.unifyNewFlags();
  }

  /**
   * Check if the plane lists have meaningfully changed
   * and trigger title update if needed
   */
  private checkForResultsUpdates(): void {
    // If we've already flagged an update, process it
    if (this.resultsUpdated) {
      this.updatePageTitle();
      this.resultsUpdated = false;
      return;
    }

    // Get hashes for current plane lists
    const skyHash = this.getPlaneListHash(this.skyPlaneLog);
    const airportHash = this.getPlaneListHash(this.airportPlaneLog);

    // If either hash has changed, update the title
    if (
      skyHash !== this.lastSkyPlaneHash ||
      airportHash !== this.lastAirportPlaneHash
    ) {
      this.updatePageTitle();
      this.lastSkyPlaneHash = skyHash;
      this.lastAirportPlaneHash = airportHash;
    }
  }

  /**
   * Create a simple hash of a plane list to detect changes
   * Only includes critical identifying information
   */
  private getPlaneListHash(planes: PlaneLogEntry[]): string {
    return planes
      .map(
        (p) =>
          `${p.icao}:${p.model || ''}:${p.isMilitary ? 1 : 0}:${
            p.filteredOut ? 1 : 0
          }`
      )
      .join(',');
  }

  /**
   * Updates the page title with information from the top plane in the results
   * Only updates when:
   * 1. A scan completes
   * 2. Filters are applied
   * 3. Component initializes
   * 4. Commercial filter is toggled
   */
  private updatePageTitle(): void {
    this.updateFilteredLogs();
    const topPlane = this.getTopPriorityPlane();

    if (topPlane) {
      // For military planes, show [MIL] [<country>] <model or callsign>
      if (topPlane.isMilitary) {
        const code =
          this.countryService.getCountryCode(topPlane.origin)?.toUpperCase() ||
          topPlane.origin;
        const display =
          topPlane.model?.trim() || '' ? topPlane.model : topPlane.callsign;
        const titleContent = `[MIL] [${code}] ${display}`;
        if (titleContent !== this.lastTitleUpdateHash) {
          this.lastTitleUpdateHash = titleContent;
          document.title = `${titleContent} peeped! | ${this.baseTitle}`;
        }
      } else {
        // Priority: operator → callsign → model
        let titleContent = '';
        if (topPlane.operator) {
          titleContent = topPlane.operator;
        } else if (topPlane.callsign && topPlane.callsign.trim().length >= 3) {
          titleContent = topPlane.callsign;
        } else if (topPlane.model) {
          titleContent = topPlane.model;
        }
        if (titleContent && titleContent !== this.lastTitleUpdateHash) {
          this.lastTitleUpdateHash = titleContent;
          document.title = `${titleContent} peeped! | ${this.baseTitle}`;
        }
      }
    } else if (this.lastTitleUpdateHash !== '') {
      this.lastTitleUpdateHash = '';
      document.title = this.emptyTitle;
    }

    this.lastSkyPlaneHash = this.getPlaneListHash(this.skyPlaneLog);
    this.lastAirportPlaneHash = this.getPlaneListHash(this.airportPlaneLog);
  }

  /**
   * Gets the highest priority plane for display in the title
   * Always prioritize any military plane, even if it has no model
   */
  private getTopPriorityPlane(): PlaneLogEntry | undefined {
    // Use the filtered lists
    const allPlanes = [
      ...this.filteredSkyPlaneLog,
      ...this.filteredAirportPlaneLog,
    ];

    if (allPlanes.length === 0) {
      return undefined;
    }

    // Always prioritize any military plane, regardless of model
    const anyMilitary = allPlanes.find((plane) => plane.isMilitary);
    if (anyMilitary) {
      return anyMilitary;
    }

    // Otherwise, prefer a plane with a model
    const anyWithModel = allPlanes.find((plane) => plane.model);
    if (anyWithModel) {
      return anyWithModel;
    }

    // Fallback: just return the first plane
    return allPlanes[0];
  }

  /** Scroll handlers to update fade state */
  onSkyScroll(event: Event): void {
    const el = event.target as HTMLElement;
    // treat near-bottom (within 2px) as bottom to hide fade reliably
    this.skyListAtBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    this.updateScrollFadeStates();
  }

  onAirportScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.airportListAtBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    this.updateScrollFadeStates();
  }

  onSeenScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.seenListAtBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    this.updateScrollFadeStates();
  }

  /** Determine if each list needs a fade overlay or not */
  private updateScrollFadeStates(): void {
    if (this.skyListRef) {
      const el = this.skyListRef.nativeElement;
      this.skyListScrollable = el.scrollHeight > el.clientHeight + 2;
      this.skyListAtBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    }
    if (this.airportListRef) {
      const el = this.airportListRef.nativeElement;
      this.airportListScrollable = el.scrollHeight > el.clientHeight + 2;
      this.airportListAtBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    }
    if (this.seenListRef) {
      const el = this.seenListRef.nativeElement;
      this.seenListScrollable = el.scrollHeight > el.clientHeight + 2;
      this.seenListAtBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    }
  }

  /** Toggle special flag on click */
  onToggleSpecial(plane: PlaneLogEntry, event: Event): void {
    event.stopPropagation();
    plane.isSpecial = !plane.isSpecial;
    this.specialListService.toggleSpecial(plane.icao);
    // Log updated list to confirm persistence
    console.log(
      '[ResultsOverlay] specials now:',
      this.specialListService.getAllSpecialIcaos()
    );
  }

  /** Assign special flags from service */
  private setSpecialFlag(planes: PlaneLogEntry[]): void {
    planes.forEach((plane) => {
      plane.isSpecial = this.specialListService.isSpecial(plane.icao);
    });
  }
}
