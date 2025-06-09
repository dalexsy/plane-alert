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
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SettingsService } from '../../services/settings.service';
import { SpecialListService } from '../../services/special-list.service';
import { ButtonComponent } from '../ui/button.component';
import { TabComponent } from '../ui/tab.component';
import { PlaneListItemComponent } from '../plane-list-item/plane-list-item.component';
import { interval, Subscription } from 'rxjs';
import { AircraftDbService } from '../../services/aircraft-db.service';
import { ScanService } from '../../services/scan.service';
import { MilitaryPrefixService } from '../../services/military-prefix.service';
import { PlaneFollowService } from '../../services/plane-follow.service';
import { AutoFollowService } from '../../services/auto-follow.service';
import { FollowCoordinatorService } from '../../services/follow-coordinator.service';
import { haversineDistance } from '../../utils/geo-utils';
import {
  trigger,
  transition,
  style,
  query,
  animate,
} from '@angular/animations';
import { IconComponent } from '../ui/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import * as L from 'leaflet';

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
  isUnknown?: boolean; // Add unknown plane flag
  onGround?: boolean; // Indicates if plane is on the ground
  airportName?: string; // Name of airport if plane is on ground near one
  airportCode?: string; // IATA code for airport if available
  airportLat?: number;
  airportLon?: number;
  altitude?: number | null; // plane altitude in meters, nullable to match PlaneModel
}

@Component({
  selector: 'app-results-overlay',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    TabComponent,
    PlaneListItemComponent,
    TooltipDirective,
  ],
  templateUrl: './results-overlay.component.html',
  styleUrls: ['./results-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        // animate new items entering
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateX(-10px)' }),
            animate(
              '200ms ease-out',
              style({ opacity: 1, transform: 'translateX(0)' })
            ),
          ],
          { optional: true }
        ),
        // animate items leaving
        query(
          ':leave',
          [
            animate(
              '200ms ease-in',
              style({ opacity: 0, transform: 'translateX(10px)' })
            ),
          ],
          { optional: true }
        ),
      ]),
    ]),
  ],
})
export class ResultsOverlayComponent
  implements OnInit, OnChanges, OnDestroy, AfterViewInit
{
  constructor(
    public settings: SettingsService,
    public countryService: CountryService,
    public planeFilter: PlaneFilterService,
    private specialListService: SpecialListService,
    private cdr: ChangeDetectorRef,
    private aircraftDb: AircraftDbService,
    private scanService: ScanService,
    private militaryPrefixService: MilitaryPrefixService,
    private planeFollowService: PlaneFollowService,
    private autoFollowService: AutoFollowService,
    private followCoordinatorService: FollowCoordinatorService
  ) {
    this.specialListService.specialListUpdated$.subscribe(() => {
      this.resultsUpdated = true;
    });
  }

  // track hover state separately for each list to avoid cross-list hover
  hoveredSkyPlaneIcao: string | null = null;
  hoveredAirportPlaneIcao: string | null = null;
  hoveredSeenPlaneIcao: string | null = null;
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
  @Input() highlightedPlaneIcao: string | null = null; // Add this input
  @Input() activePlaneIcaos: Set<string> = new Set(); // Input for active ICAOs
  @Input() clickedAirports: Set<number> = new Set(); // Track clicked airports for styling
  @Input() airportCircles: Map<number, L.Circle> = new Map(); // Airport circles for coordinate matching
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
  @Output() centerPlane = new EventEmitter<any>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  /** Whether altitude-colored borders are enabled */
  @Input() showAltitudeBorders: boolean = false;
  /** Emit when altitude borders toggle is clicked */
  @Output() altitudeBordersChange = new EventEmitter<boolean>();
  /** Get altitude borders toggle tooltip text */
  get altitudeBordersTooltip(): string {
    return this.showAltitudeBorders
      ? 'Hide altitude-colored borders'
      : 'Show altitude-colored borders';
  }
  // Shuffle mode: pick random plane to follow every interval
  shuffleMode = false;
  // Nearest follow mode: pick nearest plane to follow every interval
  nearestMode = false; // Military priority toggle: whether to prioritize military planes in sorting
  militaryPriority = true;

  // Filtered versions of the plane logs
  filteredSkyPlaneLog: PlaneLogEntry[] = [];
  filteredAirportPlaneLog: PlaneLogEntry[] = []; // Will be kept empty
  filteredSeenPlaneLog: PlaneLogEntry[] = [];
  now = Date.now();
  refreshSub!: Subscription;
  private scanSub!: Subscription;
  private followStateSub?: Subscription;
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

  // Expose services needed by the child component template bindings

  // Handle center button click from template
  public onCenterPlane(plane: PlaneLogEntry, event: Event): void {
    event.stopPropagation();
    this.centerPlane.emit(plane);
  }

  // Handle filter button click from template
  public onFilter(plane: PlaneLogEntry): void {
    this.filterPrefix.emit(plane);
  }

  // Handle clear seen list click
  public onClearHistoricalList(): void {
    this.clearHistoricalList.emit();
  }

  // Handle airport center click from child
  public handleCenterAirport(coords: { lat: number; lon: number }): void {
    this.centerAirport.emit(coords);
  }

  // Provide getTimeAgo to template
  public getTimeAgo(timestamp: number): string {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }

  ngOnInit(): void {
    // initial collapse state is set via property initializer
    // Load military prefixes if needed
    this.militaryPrefixService.loadPrefixes().then(() => {
      this.resultsUpdated = true;
    });
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
    this.scanSub = this.scanService.countdown$.subscribe((count: number) => {
      if (count > previousCount && previousCount !== 0) {
        this.resultsUpdated = true;
      }
      previousCount = count;
    });

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
    // collapse state already applied via property initializer
    // Existing initialization
    this.updateFilteredLogs();
    this.updatePageTitle();
    setTimeout(() => this.updateScrollFadeStates(), 0);
    // Subscribe to coordinator service state changes to keep UI in sync
    this.followCoordinatorService.getCurrentModes();

    // Subscribe to follow coordinator mode changes to sync UI state
    this.followStateSub = this.planeFollowService.followState$.subscribe(
      (followState) => {
        const modes = this.followCoordinatorService.getCurrentModes();

        // Update local UI state to match services
        this.shuffleMode = modes.shuffle;
        this.nearestMode = modes.nearest;

        this.cdr.detectChanges();
      }
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When input plane lists or highlighted plane change
    if (
      changes['skyPlaneLog'] ||
      changes['airportPlaneLog'] ||
      changes['highlightedPlaneIcao']
    ) {
      this.resultsUpdated = true;
      this.sortLogs();
      this.updateFilteredLogs();
    }
  }
  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.scanSub?.unsubscribe();
    this.followStateSub?.unsubscribe();
    document.title = this.baseTitle;
  }

  // --- Keep hover handlers in parent for now ---
  onHoverPlane(
    plane: PlaneLogEntry,
    listType: 'sky' | 'airport' | 'seen'
  ): void {
    if (listType === 'sky') this.hoveredSkyPlaneIcao = plane.icao;
    else if (listType === 'airport') this.hoveredAirportPlaneIcao = plane.icao;
    else if (listType === 'seen') this.hoveredSeenPlaneIcao = plane.icao;
    this.cdr.markForCheck();
    this.hoverPlane.emit(plane); // Still emit original event if needed by map
  }

  onUnhoverPlane(
    plane: PlaneLogEntry,
    listType: 'sky' | 'airport' | 'seen'
  ): void {
    if (listType === 'sky') this.hoveredSkyPlaneIcao = null;
    else if (listType === 'airport') this.hoveredAirportPlaneIcao = null;
    else if (listType === 'seen') this.hoveredSeenPlaneIcao = null;
    this.cdr.markForCheck();
    this.unhoverPlane.emit(plane); // Still emit original event
  }

  // --- Pass events from child up ---
  // Accept any event payload from child to avoid template type mismatch
  public handleCenterPlane(plane: any): void {
    this.centerPlane.emit(plane as PlaneLogEntry);
  }

  public handleFilterPrefix(plane: any): void {
    this.filterPrefix.emit(plane as PlaneLogEntry);
  }

  public handleToggleSpecial(plane: any): void {
    const p = plane as PlaneLogEntry;
    p.isSpecial = !p.isSpecial;
    this.specialListService.toggleSpecial(p.icao);

    this.cdr.markForCheck();
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
  public updateFilteredLogs(): void {
    // Filter sky planes and sort: military/special first, then airport-clicked, then by ascending distance
    const centerLat = this.settings.lat ?? 0;
    const centerLon = this.settings.lon ?? 0; // Updated comparator: prioritize military and special planes, then airport-clicked planes
    const comparator = this.militaryPriority
      ? (a: PlaneLogEntry, b: PlaneLogEntry) => {
          // Prioritize military and special planes equally at the top
          const aPriority = (a.isMilitary ? 4 : 0) + (a.isSpecial ? 4 : 0);
          const bPriority = (b.isMilitary ? 4 : 0) + (b.isSpecial ? 4 : 0);
          if (aPriority !== bPriority) return bPriority - aPriority;

          // If both have same military/special priority, check airport-clicked status
          const aAtClickedAirport = this.isPlaneAtClickedAirport(a);
          const bAtClickedAirport = this.isPlaneAtClickedAirport(b);
          if (aAtClickedAirport !== bAtClickedAirport) {
            return aAtClickedAirport ? -1 : 1; // Clicked airport planes come first
          }

          return (
            haversineDistance(centerLat, centerLon, a.lat!, a.lon!) -
            haversineDistance(centerLat, centerLon, b.lat!, b.lon!)
          );
        }
      : (a: PlaneLogEntry, b: PlaneLogEntry) => {
          // Even without military priority, still prioritize airport-clicked planes
          const aAtClickedAirport = this.isPlaneAtClickedAirport(a);
          const bAtClickedAirport = this.isPlaneAtClickedAirport(b);
          if (aAtClickedAirport !== bAtClickedAirport) {
            return aAtClickedAirport ? -1 : 1; // Clicked airport planes come first
          }

          return (
            haversineDistance(centerLat, centerLon, a.lat!, a.lon!) -
            haversineDistance(centerLat, centerLon, b.lat!, b.lon!)
          );
        };
    this.filteredSkyPlaneLog = this.skyPlaneLog
      .filter((plane) => !plane.filteredOut)
      .sort(comparator);

    // Bring manually followed plane to top
    if (this.highlightedPlaneIcao) {
      const idx = this.filteredSkyPlaneLog.findIndex(
        (p) => p.icao === this.highlightedPlaneIcao
      );
      if (idx > 0) {
        const [followed] = this.filteredSkyPlaneLog.splice(idx, 1);
        this.filteredSkyPlaneLog.unshift(followed);
      }
    }

    // Remove airport planes from overlay: set filteredAirportPlaneLog to empty
    this.filteredAirportPlaneLog = [];

    // Sort seen planes: military/special first, then by distance
    this.filteredSeenPlaneLog = this.seenPlaneLog
      .filter((plane) => !plane.filteredOut)
      .sort(comparator);

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
      // set remains handled elsewhere
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

  public sortLogs(): void {
    // No-op: preserve order provided by parent component (already sorted by distance)
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
      if (topPlane.isMilitary) {
        // For military planes, show [MIL] [...]
        const code =
          this.countryService.getCountryCode(topPlane.origin)?.toUpperCase() ||
          topPlane.origin;
        const callsignPrefix = topPlane.callsign
          ? topPlane.callsign.substring(0, 3).toUpperCase()
          : 'N/A';
        const display =
          topPlane.model?.trim() || '' ? topPlane.model : topPlane.callsign;
        const titleContent = `[MIL] [${code}/${callsignPrefix}] ${display}`;
        if (titleContent !== this.lastTitleUpdateHash) {
          this.lastTitleUpdateHash = titleContent;
          document.title = `${titleContent} peeped! | ${this.baseTitle}`;
        }
      } else if (topPlane.isSpecial) {
        // Special planes: same as military but without [MIL]
        const code =
          this.countryService.getCountryCode(topPlane.origin)?.toUpperCase() ||
          topPlane.origin;
        const callsignPrefix = topPlane.callsign
          ? topPlane.callsign.substring(0, 3).toUpperCase()
          : 'N/A';
        const displayModel = topPlane.model?.trim() || topPlane.callsign;
        const specialTitle = `[${code}/${callsignPrefix}] ${displayModel} peeped!`;
        if (specialTitle !== this.lastTitleUpdateHash) {
          this.lastTitleUpdateHash = specialTitle;
          document.title = `${specialTitle} | ${this.baseTitle}`;
        }
      } else {
        // Non-military, non-special: stinky title variant
        let display = '';
        if (topPlane.operator) display = topPlane.operator;
        else if (topPlane.callsign && topPlane.callsign.trim().length >= 3)
          display = topPlane.callsign;
        else if (topPlane.model) display = topPlane.model;
        if (display && display !== this.lastTitleUpdateHash) {
          this.lastTitleUpdateHash = display;
          document.title = `Just stinky ${display}. | ${this.baseTitle}`;
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
   * Always prioritize any military or special plane, even if it has no model
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

    // Prioritize military planes first, then special planes
    const anyMilitary = allPlanes.find((plane) => plane.isMilitary);
    if (anyMilitary) {
      return anyMilitary;
    }
    const anySpecial = allPlanes.find((plane) => plane.isSpecial);
    if (anySpecial) {
      return anySpecial;
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
  }
  /** Assign special flags from service */
  private setSpecialFlag(planes: PlaneLogEntry[]): void {
    planes.forEach((plane) => {
      plane.isSpecial = this.specialListService.isSpecial(plane.icao);
    });
  }

  public collapsed = localStorage.getItem('resultsOverlayCollapsed') === 'true';

  public toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('resultsOverlayCollapsed', this.collapsed.toString());
    this.cdr.detectChanges();
  } /** Toggle shuffle mode on/off */
  public toggleShuffle(): void {
    const now = Date.now();
    if (now - this.lastToggleTime < this.DEBOUNCE_TIME) return;
    this.lastToggleTime = now;
    // Toggle shuffle mode through coordinator service
    const newShuffleState = this.followCoordinatorService.toggleShuffleMode(
      this.filteredSkyPlaneLog
    );

    // Update local state to match coordinator decision
    if (newShuffleState !== this.shuffleMode) {
      this.shuffleMode = newShuffleState;

      // Update local subscriptions to match
      if (this.shuffleMode) {
        // Coordinator handles the actual shuffling, but we track state locally
        this.nearestMode = false; // Ensure nearest is disabled
        // Note: No need to call stopNearest() as coordinator handles cleanup
      } else {
        // Note: No need to call stopShuffle() as coordinator handles cleanup
      }
    }

    this.cdr.detectChanges();
  }
  /** Toggle nearest follow mode on/off */
  public toggleNearest(): void {
    const now = Date.now();
    if (now - this.lastToggleTime < this.DEBOUNCE_TIME) return;
    this.lastToggleTime = now;
    // Toggle nearest mode through coordinator service
    const newNearestState = this.followCoordinatorService.toggleNearestMode(
      this.filteredSkyPlaneLog
    );

    // Update local state to match coordinator decision
    if (newNearestState !== this.nearestMode) {
      this.nearestMode = newNearestState;

      // Update local subscriptions to match
      if (this.nearestMode) {
        // Coordinator handles the actual nearest following, but we track state locally
        this.shuffleMode = false; // Ensure shuffle is disabled
        // Note: No need to call stopShuffle() as coordinator handles cleanup
      } else {
        // Note: No need to call stopNearest() as coordinator handles cleanup
      }
    }

    this.cdr.detectChanges();
  }

  /** Toggle military priority sorting on/off */
  public toggleMilitaryPriority(): void {
    this.militaryPriority = !this.militaryPriority;
    this.resultsUpdated = true; // Only re-sort and reshuffle if there are military planes visible
    const hasMilitary = this.filteredSkyPlaneLog.some((p) => p.isMilitary);
    if (hasMilitary) {
      this.updateFilteredLogs();
      if (this.shuffleMode) {
        // Let coordinator handle re-shuffle with new military priority
        this.followCoordinatorService.updateAutomaticModes(
          this.filteredSkyPlaneLog
        );
      }
    }
    this.cdr.detectChanges();
  }
  /** Number of military planes currently visible in the sky list */
  get militaryCount(): number {
    return this.filteredSkyPlaneLog.filter((p) => p.isMilitary).length;
  }
  /**
   * Trigger a new shuffle selection, called when a shuffled plane disappears
   * Public method to be called from the map component
   */
  public triggerNewShuffle(): void {
    // Use coordinator service to handle plane disappearance intelligently
    // The coordinator will check which mode is active and trigger appropriate action
    if (this.highlightedPlaneIcao) {
      this.followCoordinatorService.handlePlaneDisappearance(
        this.highlightedPlaneIcao,
        this.filteredSkyPlaneLog
      );
    } else if (this.shuffleMode) {
      // Fallback: if no specific plane but shuffle mode is active, trigger new shuffle
      this.followCoordinatorService.toggleShuffleMode(this.filteredSkyPlaneLog);
      this.followCoordinatorService.toggleShuffleMode(this.filteredSkyPlaneLog);
    }
  } /** Check if a plane is located at a clicked airport using airport badge logic */
  private isPlaneAtClickedAirport(plane: PlaneLogEntry): boolean {
    // Must have an airport name to be considered at an airport
    if (!plane.airportName) {
      return false;
    }

    // Must meet airport badge criteria: onGround OR altitude <= 200m
    const meetsAirportCriteria =
      plane.onGround === true ||
      (plane.altitude != null && plane.altitude <= 200);

    if (!meetsAirportCriteria) {
      return false;
    }

    // Must have coordinates and clicked airports to check
    const hasCoordinates = plane.lat != null && plane.lon != null;
    const hasClickedAirports = this.clickedAirports.size > 0;
    const hasAirportCircles =
      this.airportCircles && this.airportCircles.size > 0;

    if (!hasCoordinates || !hasClickedAirports || !hasAirportCircles) {
      return false;
    }

    // Check if plane coordinates are within any clicked airport circle
    for (const [airportId, circle] of this.airportCircles.entries()) {
      if (this.clickedAirports.has(airportId)) {
        const airportCenter = circle.getLatLng();
        const radiusKm = circle.getRadius() / 1000; // Convert from meters to km
        const distance = haversineDistance(
          plane.lat!,
          plane.lon!,
          airportCenter.lat,
          airportCenter.lng
        );

        if (distance <= radiusKm) {
          return true;
        }
      }
    }
    return false;
  }

  /** Get collapse/expand tooltip text */
  get collapseTooltip(): string {
    return this.collapsed ? 'Expand results' : 'Collapse results';
  }

  /** Get commercial filter toggle tooltip text */
  get commercialFilterTooltip(): string {
    return this.settings.excludeDiscount
      ? 'Show commercial'
      : 'Hide commercial';
  }

  /** Get commercial mute toggle tooltip text */
  get commercialMuteTooltip(): string {
    return this.commercialMute
      ? 'Unmute commercial alert'
      : 'Mute military alert';
  }

  /** Get shuffle mode toggle tooltip text */
  get shuffleTooltip(): string {
    return this.shuffleMode ? 'Disable shuffle mode' : 'Enable shuffle mode';
  }

  /** Get nearest follow toggle tooltip text */
  get nearestTooltip(): string {
    return this.nearestMode
      ? 'Disable nearest follow'
      : 'Enable nearest follow';
  }
  /** Get military priority toggle tooltip text */
  get militaryPriorityTooltip(): string {
    return this.militaryPriority
      ? 'Disable military priority'
      : 'Enable military priority';
  }

  /** Get seen planes section toggle tooltip text */
  get seenSectionTooltip(): string {
    return `Click to ${this.seenCollapsed ? 'expand' : 'collapse'}`;
  }
}
