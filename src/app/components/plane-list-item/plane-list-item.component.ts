// src/app/components/plane-list-item/plane-list-item.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  // Add HostBinding for dynamic classes
  HostBinding,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlaneLogEntry } from '../results-overlay/results-overlay.component'; // Adjust path if needed
import { TooltipDirective } from '../../directives/tooltip.directive';
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SettingsService } from '../../services/settings.service';
import { ButtonComponent } from '../ui/button.component'; // Assuming ButtonComponent is standalone
import { haversineDistance } from '../../utils/geo-utils';
import {
  DistanceUnit,
  convertFromKm,
  getDistanceUnitShortLabel,
  formatDistanceWithTenths,
} from '../../utils/units.util';
import { PlaneStyleService } from '../../services/plane-style.service';
import { AnnouncementService } from '../../services/announcement.service';
import { OperatorTooltipService } from '../../services/operator-tooltip.service';
import { OperatorSymbolConfig } from '../../config/operator-symbols.config';
import { AircraftImageTooltipComponent } from '../ui/aircraft-image-tooltip.component';
import {
  AircraftImageService,
  AircraftImage,
} from '../../services/aircraft-image.service';

@Component({
  selector: 'app-plane-list-item',
  standalone: true,
  imports: [
    AircraftImageTooltipComponent,
    CommonModule,
    ButtonComponent,
    TooltipDirective,
  ],
  templateUrl: './plane-list-item.component.html',
  styleUrls: ['./plane-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Use OnPush for performance
})
export class PlaneListItemComponent implements OnChanges, OnDestroy {
  private distanceUnitSubscription?: Subscription; /** Distance from center, in current unit rounded to nearest tenth */
  get distanceKm(): number {
    const lat = this.settings.lat ?? 0;
    const lon = this.settings.lon ?? 0;
    if (this.plane.lat == null || this.plane.lon == null) return 0;
    const distanceInKm = haversineDistance(
      lat,
      lon,
      this.plane.lat,
      this.plane.lon,
    );
    const unit = this.settings.distanceUnit as DistanceUnit;
    return Math.round(convertFromKm(distanceInKm, unit) * 10) / 10;
  }

  /** Get distance unit for display */
  get distanceUnit(): string {
    const unit = this.settings.distanceUnit as DistanceUnit;
    return getDistanceUnitShortLabel(unit);
  } /** Format distance with proper decimal separator (always period) */
  get formattedDistance(): string {
    return formatDistanceWithTenths(this.distanceKm);
  }

  @Input({ required: true }) plane!: PlaneLogEntry;

  private formatAirportTooltip(
    name: string | undefined,
    code: string | undefined,
  ): string {
    if (typeof name === 'string' && name.trim()) return name.trim();
    if (typeof code === 'string' && code.trim()) return code.trim();
    return '';
  }

  /** Returns true if a string looks like a lat/lon coordinate rather than an airport code. */
  private looksLikeCoordinate(code: string): boolean {
    if (!code) return false;
    const c = code.trim().toUpperCase();
    if (/^\d{4}[NS]\d{5}[EW]$/.test(c)) return true;
    if (/^[NS]\d{4,6}[EW]\d{4,6}$/.test(c)) return true;
    if (/^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(c)) return true;
    if (/^-?\d{1,3}\.\d+[,\/ ]\s*-?\d{1,3}\.\d+$/.test(c)) return true;
    return false;
  }

  get routeOriginDisplay(): string {
    const raw = this.plane.routeOriginIata || this.plane.routeOrigin;
    if (raw && this.looksLikeCoordinate(raw)) return '?';
    if (raw) return raw;
    // No airport code — use resolved place name if available (e.g. reverse-geocoded waypoint)
    if (this.plane.routeOriginName) return this.plane.routeOriginName;
    return '?';
  }

  get routeDestinationDisplay(): string {
    const raw =
      this.plane.routeDestinationIata || this.plane.routeDestination;
    if (raw && this.looksLikeCoordinate(raw)) return '?';
    if (raw) return raw;
    // No airport code — use resolved place name if available (e.g. reverse-geocoded waypoint)
    if (this.plane.routeDestinationName) return this.plane.routeDestinationName;
    return '?';
  }

  get routeTooltip(): string {
    const originText = this.formatAirportTooltip(
      this.plane.routeOriginName,
      this.routeOriginDisplay,
    );
    const destText = this.formatAirportTooltip(
      this.plane.routeDestinationName,
      this.routeDestinationDisplay,
    );

    if (originText && destText) return `${originText} → ${destText}`;
    return originText || destText || '';
  }

  get routeStatusIcon(): string | null {
    if (this.plane.routeCancelled) return 'cancel';
    if (this.plane.routeDiverted) return 'swap_horiz';

    const status =
      typeof this.plane.routeStatus === 'string'
        ? this.plane.routeStatus.toLowerCase()
        : '';
    if (status.includes('landed') || status.includes('arrived'))
      return 'flight_land';

    return null;
  }

  get localizedEta(): string | undefined {
    const utcEta = this.plane.routeEtaUtc;
    if (!utcEta || typeof utcEta !== 'string') return undefined;

    // Parse UTC time like "12:34Z"
    const match = utcEta.match(/^(\d{2}):(\d{2})Z?$/);
    if (!match) return undefined;

    const utcHours = parseInt(match[1], 10);
    const utcMinutes = parseInt(match[2], 10);

    // Create a date object for today in UTC with the ETA time
    const now = new Date();
    const utcDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        utcHours,
        utcMinutes,
      ),
    );

    // Convert to local time and format
    const localHours = utcDate.getHours();
    const localMinutes = utcDate.getMinutes();
    const formattedHours = String(localHours).padStart(2, '0');
    const formattedMinutes = String(localMinutes).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}`;
  }
  // Reflect military/special state on host element for styling
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.plane?.isSpecial === true;
  }
  @HostBinding('class.a380-plane') get hostA380() {
    return this.plane?.isA380 === true;
  }
  @HostBinding('class.new-plane') get hostNew() {
    return this.plane?.isNew === true;
  }
  @Input() highlightedPlaneIcao: string | null = null;
  @HostBinding('class.highlighted-plane')
  get hostHighlighted(): boolean {
    return this.plane.icao === this.highlightedPlaneIcao;
  }
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky'; // Default or require
  @Input() hoveredPlaneIcao: string | null = null; // For special icon hover
  @Input() now: number = Date.now();
  @Input() activePlaneIcaos: Set<string> = new Set();
  @Input() followedPlaneIcao: string | null = null;
  @Input() clickedAirports: Set<number> = new Set(); // Track clicked airports
  @Input() airportCircles: Map<number, L.Circle> = new Map(); // Airport circles for coordinate matching
  // Helper method to check if this plane's airport is clicked using airport badge logic
  isAirportClicked(): boolean {
    // Must have an airport name to be considered at an airport
    if (!this.plane.airportName) {
      return false;
    }

    // Must meet airport badge criteria: onGround OR altitude <= 200m
    const meetsAirportCriteria =
      this.plane.onGround === true ||
      (this.plane.altitude != null && this.plane.altitude <= 200);

    if (!meetsAirportCriteria) {
      return false;
    }

    // Must have clicked airports and coordinates to check
    if (
      !this.clickedAirports ||
      this.clickedAirports.size === 0 ||
      !this.airportCircles ||
      this.airportCircles.size === 0 ||
      this.plane.lat == null ||
      this.plane.lon == null
    ) {
      return false;
    }

    // Check if plane is within any clicked airport circle
    for (const [airportId, circle] of this.airportCircles) {
      if (this.clickedAirports.has(airportId)) {
        const airportCenter = circle.getLatLng();
        const airportRadius = circle.getRadius(); // in meters

        const distance =
          haversineDistance(
            this.plane.lat!,
            this.plane.lon!,
            airportCenter.lat,
            airportCenter.lng,
          ) * 1000; // convert km to meters

        if (distance <= airportRadius) {
          return true;
        }
      }
    }

    return false;
  }
  @HostBinding('class.followed-plane')
  get hostFollowed(): boolean {
    return this.plane.icao === this.followedPlaneIcao;
  }

  @HostBinding('class.airport-clicked')
  get hostAirportClicked(): boolean {
    return this.isAirportClicked();
  }

  @HostBinding('class.faded-out')
  get hostFadedOut(): boolean {
    // Only fade out if not followed
    return (
      !this.activePlaneIcaos.has(this.plane.icao) &&
      this.plane.icao !== this.followedPlaneIcao
    );
  }

  // Aircraft image hover properties
  aircraftImage: AircraftImage | null = null;
  showImageTooltip = false;
  isLoadingImage = false;
  tooltipPosition = { x: 0, y: 0 };

  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  constructor(
    private settings: SettingsService,
    public countryService: CountryService,
    public planeFilter: PlaneFilterService,
    public planeStyle: PlaneStyleService,
    private announcementService: AnnouncementService,
    private operatorTooltipService: OperatorTooltipService,
    private aircraftImageService: AircraftImageService,
    private cdr: ChangeDetectorRef,
  ) {
    // Subscribe to distance unit changes to trigger change detection
    this.distanceUnitSubscription = this.settings.distanceUnitChanged.subscribe(
      () => {
        this.cdr.markForCheck();
      },
    );
  }

  ngOnDestroy(): void {
    this.distanceUnitSubscription?.unsubscribe();
  }

  // Make the whole item clickable: clicking the host emits centerPlane
  @HostListener('click')
  onHostClick(): void {
    this.centerPlane.emit(this.plane);
  }

  // Keep hover/unhover in parent for simplicity for now

  // Keep getTimeAgo logic here as it's specific to the 'seen' variant display
  getTimeAgo(timestamp: number): string {
    const diff = Math.floor((this.now - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(minutes / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ${minutes % 60}m ago`;
  }
  /** Get matched operator symbol config */
  public get operatorSymbolConfig(): OperatorSymbolConfig | null {
    return this.operatorTooltipService.getSymbolConfig(this.plane) ?? null;
  }

  // --- Event Handlers ---
  onCenterPlane(event: Event): void {
    event.stopPropagation(); // Prevent triggering other clicks if nested
    this.centerPlane.emit(this.plane);
  }

  onCenterPlaneMouseEnter(): void {
    this.hoverPlane.emit(this.plane);
  }

  onCenterPlaneMouseLeave(): void {
    this.unhoverPlane.emit(this.plane);
  }

  onFilter(event: Event): void {
    event.stopPropagation();
    if (this.plane.isMilitary) {
      // Military planes bypass the callsign prefix filter; toggle ICAO mute instead
      this.settings.toggleMutedIcao(this.plane.icao);
      this.cdr.markForCheck();
    } else {
      this.filterPrefix.emit(this.plane);
    }
  }

  onToggleSpecial(event: Event): void {
    event.stopPropagation();
    this.toggleSpecial.emit(this.plane);
  }

  get isMuted(): boolean {
    return this.settings.isMutedIcao(this.plane.icao);
  }

  onCenterAirport(event: Event): void {
    event.stopPropagation();
    if (this.plane.airportLat != null && this.plane.airportLon != null) {
      this.centerAirport.emit({
        lat: this.plane.airportLat,
        lon: this.plane.airportLon,
      });
    }
  }

  /** Check if model is generic and shouldn't link to Bing search */
  isGenericModel(model: string): boolean {
    const genericModels = ['Helicopter', 'Unknown', 'Aircraft'];
    return genericModels.includes(model);
  }

  /** Construct Bing search query for aircraft model */
  get bingSearchQuery(): string {
    if (!this.plane.model) return '';

    // Create search query similar to aircraft image service
    let searchQuery = `${this.plane.model} aircraft airplane`;
    if (this.plane.operator && this.plane.operator.trim()) {
      // Add operator to search for more specific results
      const operatorShort = this.plane.operator.split(' ')[0]; // Take first word
      searchQuery += ` ${operatorShort}`;
    }

    // Add terms to avoid non-aircraft results
    searchQuery +=
      ' -cartoon -drawing -model -toy -lego -illustration -diagram';

    return encodeURIComponent(searchQuery);
  }

  /** Handle mouse enter on model name to show aircraft image */
  onModelMouseEnter(event: MouseEvent): void {
    if (!this.plane.model || this.isGenericModel(this.plane.model)) {
      return;
    }

    // If we already have the image cached, just show it
    if (this.aircraftImage) {
      this.showImageTooltip = true;
      return;
    }

    // If we're already loading, don't start another request
    if (this.isLoadingImage) {
      return;
    }

    // Capture mouse position for tooltip placement
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate tooltip position with bounds checking
    const tooltipWidth = 300; // approximate width
    const tooltipHeight = 200; // approximate height
    const margin = 10;

    let tooltipX = mouseX + margin;
    let tooltipY = mouseY + margin;

    // Adjust if tooltip would go off-screen
    if (tooltipX + tooltipWidth > window.innerWidth) {
      tooltipX = mouseX - tooltipWidth - margin;
    }
    if (tooltipY + tooltipHeight > window.innerHeight) {
      tooltipY = mouseY - tooltipHeight - margin;
    }

    this.tooltipPosition.x = Math.max(0, tooltipX);
    this.tooltipPosition.y = Math.max(0, tooltipY);

    this.isLoadingImage = true;
    this.showImageTooltip = true;

    this.aircraftImageService
      .getAircraftImage(this.plane.r, this.plane.icao)
      .subscribe({
        next: (image) => {
          this.aircraftImage = image;
          this.isLoadingImage = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.aircraftImage = null;
          this.isLoadingImage = false;
          this.cdr.detectChanges();
        },
      });
  }

  /** Handle mouse leave on model name to hide aircraft image */
  onModelMouseLeave(): void {
    this.showImageTooltip = false;
    // Keep aircraftImage cached - don't clear it
    this.isLoadingImage = false;

    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Clear cached image when plane changes
    if (changes['plane'] && !changes['plane'].firstChange) {
      this.aircraftImage = null;
      this.isLoadingImage = false;
      this.showImageTooltip = false;
    }

    // Announce new plane
    if (this.plane.isNew) {
      const context = { isAirportClicked: this.hostAirportClicked };
      this.announcementService.announceNewAircraft(this.plane, context);
    }
  }
}
