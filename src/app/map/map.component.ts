// src/app/map/map.component.ts
import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ViewEncapsulation,
  HostListener,
  NgZone,
  Inject,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { haversineDistance } from '../utils/geo-utils';
import { RadiusComponent } from '../components/radius/radius.component';
import { ConeComponent } from '../components/cone/cone.component';
import { InputOverlayComponent } from '../components/input-overlay/input-overlay.component';
import {
  ResultsOverlayComponent,
  PlaneLogEntry,
} from '../components/results-overlay/results-overlay.component';
import { CountryService } from '../services/country.service';
import { PlaneFinderService } from '../services/plane-finder.service';
import { PlaneFilterService } from '../services/plane-filter.service';
import { AircraftDbService } from '../services/aircraft-db.service';
import { SettingsService } from '../services/settings.service';
import { ScanService } from '../services/scan.service';
import { playAlertSound, playHerculesAlert } from '../utils/alert-sound';
import { PlaneModel } from '../models/plane-model';
import { ensureStripedPattern } from '../utils/svg-utils'; // remove if unused later
import { SpecialListService } from '../services/special-list.service';
import { MapPanService } from '../services/map-pan.service';
import { MapService } from '../services/map.service';
import { MilitaryPrefixService } from '../services/military-prefix.service';
import { DOCUMENT } from '@angular/common';
import { ClockComponent } from '../components/ui/clock.component';
import { TemperatureComponent } from '../components/ui/temperature.component';
import { ClosestPlaneOverlayComponent } from '../components/closest-plane-overlay/closest-plane-overlay.component';
import { LocationOverlayComponent } from '../components/location-overlay/location-overlay.component';
import { LocationService } from '../services/location.service';
import SunCalc from 'suncalc';
import { IconComponent } from '../components/ui/icon.component';
import { WindowViewOverlayComponent } from '../components/window-view-overlay/window-view-overlay.component';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import { getIconPathForModel } from '../utils/plane-icons';
import { computeWindowHistoryPositions } from '../utils/window-history-trail-utils';
import { HelicopterListService } from '../services/helicopter-list.service';
import { HelicopterIdentificationService } from '../services/helicopter-identification.service';
import { SkyColorSyncService } from '../services/sky-color-sync.service';
import { GeocodingCacheService } from '../services/geocoding-cache.service';
import { DebouncedClickService } from '../services/debounced-click.service';
import { LocationContextService } from '../services/location-context.service';
import '../utils/plane-debug'; // Import debugging utilities for browser console

// OpenWeatherMap tile service API key
const OPEN_WEATHER_MAP_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699';

// Interface for Overpass API airport results
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number; // For nodes
  lon?: number; // For nodes
  center?: { lat: number; lon: number }; // For ways/relations
  tags?: { [key: string]: string };
}

const MAJOR_AIRPORT_RADIUS_KM = 5;
const MINOR_AIRPORT_RADIUS_KM = 1;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    ConeComponent,
    InputOverlayComponent,
    ResultsOverlayComponent,
    ClockComponent,
    TemperatureComponent,
    ClosestPlaneOverlayComponent,
    LocationOverlayComponent,
    IconComponent, // added for sun angle overlay
    WindowViewOverlayComponent,
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None, // Restored for Leaflet map elements
})
export class MapComponent implements AfterViewInit, OnDestroy {
  /** Flag for panning state, toggles pointer-events on overlays */
  @HostBinding('class.map-panning') panning = false;

  @ViewChild(InputOverlayComponent, { static: true })
  inputOverlayComponent!: InputOverlayComponent;
  @ViewChild(ResultsOverlayComponent, { static: true })
  resultsOverlayComponent!: ResultsOverlayComponent;

  readonly DEFAULT_COORDS: [number, number] = [52.3667, 13.5033];

  map!: L.Map;
  planeNewTimestamps = new Map<string, number>();
  planeLog = new Map<string, PlaneModel>();
  planeHistoricalLog: PlaneModel[] = [];

  currentLocationMarker!: L.Marker;
  // airportCircle!: L.Circle; // REMOVED - Replaced by dynamic airport circles
  homeMarker: L.Marker | null = null;

  // airportCoords: [number, number] = this.DEFAULT_COORDS; // REMOVED - No longer needed for single airport
  airportRadiusKm = 3; // Radius for individual airport circles
  manualUpdate = false;
  private toggling = false;
  private locationErrorShown = false;

  // before: coneVisible = false; // Default to hidden
  coneVisible = false; // Default to hidden
  // before: cloudVisible = true; // Show cloud layer by default
  cloudVisible = true; // Show cloud layer by default
  // before: rainVisible = true; // Show rain layer by default
  rainVisible = true; // Show rain layer by default

  // Opacity settings for weather layers
  cloudOpacity: number = 1;
  rainOpacity: number = 0.8;

  // Planes for window-view overlay
  windowViewPlanes: WindowViewPlane[] = [];

  // Store found airports and their circles
  airportCircles = new Map<number, L.Circle>(); // Key: Overpass element ID
  private svgPatternRetryTimeout: any = null;
  private mainRadiusCircle?: L.Circle;
  private coneLayers: L.Polygon[] = [];
  // Cache computed radii (km) per airport ID to avoid repeat Overpass calls
  private airportRadiusCache = new Map<number, number>(); // Store metadata for each airport: name and IATA code
  private airportData = new Map<number, { name: string; code?: string }>(); // Track clicked airports for color toggling
  clickedAirports = new Set<number>();

  // Flag for airport fetching (loading) to show loading indicator
  loadingAirports = false;
  // Flag for viewport resizing (legacy) if needed
  isResizing = false;
  private resizeTimeout: any;

  // Tile layer for cloud coverage overlay from OpenWeatherMap
  private cloudLayer?: L.TileLayer;

  // Tile layer for rain coverage overlay from OpenWeatherMap
  private rainLayer?: L.TileLayer;

  // Currently highlighted plane ICAO (for persistent tooltip/marker highlight)
  highlightedPlaneIcao: string | null = null;
  centerZoom: number | null = null;
  private currentFaviconUrl: string = '';
  // Set of ICAOs for planes currently active on the map
  activePlaneIcaos = new Set<string>();

  // New properties for closest-plane overlay
  closestPlane: PlaneModel | null = null;
  closestDistance: number | null = null;
  closestOperator: string | null = null;
  closestSecondsAway: number | null = null;
  closestVelocity: number | null = null;
  /** Whether user is following the nearest overlay plane */
  followNearest = false;

  private airportsLoading = false; // guard for Overpass fetches
  currentTime: string = '';

  // Replace showDateTime property initializer
  public showDateTime = true; // Show date/time overlay by default

  // Toggle for airport labels tooltips
  // before: showAirportLabels: boolean = true;
  showAirportLabels = true; // Show airport labels by default

  private _initialScanDone = false; // Flag to prevent double scan

  // New properties for location-overlay component
  locationStreet: string | null = null;
  locationDistrict: string | null = null;

  // Sun angle for solar position overlay
  public sunAngle: number = 0;
  // Wind direction for wind indicator overlay
  public windAngle: number = 0; // Latest wind speed in m/s
  public windSpeed: number = 0;
  public windStat: number = 0; // intensity level 0-3
  // Wind unit cycling
  public windUnits: string[] = ['m/s', 'knots', 'km/h', 'mph'];
  public currentWindUnitIndex: number = 0;
  public isNight: boolean = false;
  public brightness: number = 1;
  public moonFraction: number = 0;
  public moonAngle: number = 0;
  public moonIsWaning: boolean = false;
  public moonIcon: string = 'dark_mode';
  public moonPhaseName: string = '';
  public moonIllumAngleDeg: number = 0;
  // Label for next sun event (Sunset during day, Sunrise at night)
  public sunEventText: string = '';
  private sunAngleInterval: any;
  private locationUpdateSubscription: any;
  private globalTooltipClickHandler!: (e: MouseEvent) => void;
  constructor(
    @Inject(DOCUMENT) private document: Document,
    public countryService: CountryService,
    private mapService: MapService,
    private planeFinder: PlaneFinderService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private settings: SettingsService,
    private scanService: ScanService,
    private specialListService: SpecialListService,
    private mapPanService: MapPanService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private militaryPrefixService: MilitaryPrefixService,
    private locationService: LocationService,
    private helicopterListService: HelicopterListService,
    private helicopterIdentificationService: HelicopterIdentificationService,
    private skyColorSyncService: SkyColorSyncService,
    private locationContextService: LocationContextService,
    private geocodingCache: GeocodingCacheService,
    private debouncedClickService: DebouncedClickService
  ) {
    // Initialize UI toggles from stored settings
    this.cloudVisible = this.settings.showCloudCover;
    this.rainVisible = this.settings.showRainCover;
    this.coneVisible = this.settings.showViewAxes;
    this.showDateTime = this.settings.showDateTimeOverlay;
    this.showAirportLabels = this.settings.showAirportLabels;

    // Update tooltip classes on special list changes
    this.specialListService.specialListUpdated$.subscribe(() => {
      this.planeLog.forEach((plane) => {
        const tooltipEl = plane.marker?.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.classList.toggle(
            'special-plane-tooltip',
            this.specialListService.isSpecial(plane.icao)
          );
        }
        // Also update marker icon class
        const markerEl = plane.marker?.getElement();
        if (markerEl) {
          markerEl.classList.toggle(
            'special-plane',
            this.specialListService.isSpecial(plane.icao)
          );
        }
      });
    });

    // Listen for tooltip follow/unfollow events
    window.addEventListener('plane-tooltip-follow', (e: Event) => {
      const icao = (e as CustomEvent).detail?.icao;
      if (!icao) return;
      this.ngZone.run(() => {
        if (this.highlightedPlaneIcao === icao) {
          this.unhighlightPlane(icao);
          this.highlightedPlaneIcao = null;
          this.followNearest = false;
        } else {
          this.highlightedPlaneIcao = icao;
          this.followNearest = true;
          // Center map on followed plane
          const pm = this.planeLog.get(icao);
          if (pm && pm.lat != null && pm.lon != null) {
            this.map.panTo([pm.lat, pm.lon]);
            // Update both address input overlay and location overlay info with single geocoding call
            this.reverseGeocode(pm.lat, pm.lon).then((address) => {
              this.inputOverlayComponent.addressInputRef.nativeElement.value =
                address;
              this.locationDistrict = address;
              this.cdr.detectChanges();
            });
          }
        }
        this.updatePlaneLog(Array.from(this.planeLog.values()));
        this.updateFollowedStyles(); // <-- ensure all planes update
        this.cdr.detectChanges();
      });
    }); // Add global click handler for tooltip follow
    window.addEventListener('click', this.globalTooltipClickHandler);
  }

  /** Toggle map brightness between normal and dimmed */
  public toggleBrightness(): void {
    this.brightness = this.brightness === 1 ? 0.3 : 1;
    const container = this.map.getContainer();
    if (container) {
      container.style.filter = `brightness(${this.brightness})`;
    }
  }
  /** Zoom in the map */
  public onZoomIn(): void {
    if (this.map) {
      this.map.zoomIn();
    }
  }

  /** Zoom out the map */
  public onZoomOut(): void {
    if (this.map) {
      this.map.zoomOut();
    }
  }

  /** Toggle display of airport labels tooltips universally (permanent on map) */
  public onToggleAirportLabels(): void {
    this.showAirportLabels = !this.showAirportLabels;
    // Persist preference
    this.settings.setShowAirportLabels(this.showAirportLabels);
    this.airportCircles.forEach((circle, id) => {
      const data = this.airportData.get(id);
      if (!data) return;
      // Rebind tooltip with permanent flag toggled
      circle.unbindTooltip();
      circle.bindTooltip(data.name, {
        direction: 'center',
        className: 'airport-tooltip',
        opacity: 0.8,
        offset: [0, 0],
        permanent: this.showAirportLabels,
      });
      // Open or close tooltip based on permanent flag
      if (this.showAirportLabels) {
        circle.openTooltip();
      } else {
        circle.closeTooltip();
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.countryService.init();
    await this.aircraftDb.load();
    await this.militaryPrefixService.loadPrefixes();
    this.settings.load();
    this.showDateTime = this.settings.showDateTimeOverlay;

    // Load clicked airports from settings
    this.clickedAirports = this.settings.getClickedAirports();

    // --- Clear all historical trail data on startup to prevent lag ---
    this.planeHistoricalLog = [];
    this.resultsOverlayComponent.seenPlaneLog = [];
    this.planeLog.forEach((plane) => {
      plane.positionHistory = [];
      if (plane.historyTrailSegments) plane.historyTrailSegments = [];
    });

    // Update tooltip classes on special list changes
    this.specialListService.specialListUpdated$.subscribe(() => {
      this.planeLog.forEach((plane) => {
        const tooltipEl = plane.marker?.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.classList.toggle(
            'special-plane-tooltip',
            this.specialListService.isSpecial(plane.icao)
          );
        }
        // Also update marker icon class
        const markerEl = plane.marker?.getElement();
        if (markerEl) {
          markerEl.classList.toggle(
            'special-plane',
            this.specialListService.isSpecial(plane.icao)
          );
        }
      });
    });

    // Add global click handler for tooltip follow
    window.addEventListener('click', this.globalTooltipClickHandler);

    // Initialize input overlay component inputs if necessary
    if (this.inputOverlayComponent) {
      // Sync input props
      this.inputOverlayComponent.showDateTime = this.showDateTime;
      this.inputOverlayComponent.showCloudCover = this.settings.showCloudCover;
      this.inputOverlayComponent.showRainCover = this.settings.showRainCover;
      this.inputOverlayComponent.showViewAxes = this.settings.showViewAxes;
      this.inputOverlayComponent.showAirportLabels =
        this.settings.showAirportLabels;
    }
    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;

    const storedExclude = localStorage.getItem('excludeDiscount');
    if (storedExclude !== null) {
      this.settings.excludeDiscount = storedExclude === 'true';
    }

    // Initialize map and overlays
    this.initMap(lat, lon, radius);
    // Apply map layer visibility based on saved preferences
    this.toggleCloudCover(this.settings.showCloudCover);
    this.toggleRainCover(this.settings.showRainCover);
    this.toggleConeVisibility(this.settings.showViewAxes);
    // Apply airport labels visibility
    this.showAirportLabels = this.settings.showAirportLabels;
    this.airportCircles.forEach((circle, id) => {
      circle[this.showAirportLabels ? 'openTooltip' : 'closeTooltip']();
    });
    // Provide the created map instance to the service
    this.mapService.setMapInstance(this.map);
    // Main radius will be drawn by updateMap to avoid duplicate initial draw
    // Force Angular to detect view changes so radius and cone components render
    this.cdr.detectChanges();
    // Initial map update to draw radius, airports, and planes
    this.updateMap(lat, lon, radius);
    // updateMap is called within initMap now via findAndDisplayAirports
    // this.updateMap(lat, lon, radius); // REMOVED - initMap handles initial load

    // Initialize home marker if home location exists
    this.initHomeMarker();

    // Check if we're at home location and enable cones if we are
    const homeLocation = this.settings.getHomeLocation();
    if (
      homeLocation &&
      Math.abs(lat - homeLocation.lat) < 0.0001 &&
      Math.abs(lon - homeLocation.lon) < 0.0001
    ) {
      // We're starting at the home position, enable cones
      this.coneVisible = true;

      // Update the Show View Axes checkbox to match
      setTimeout(() => {
        const coneCheckbox = document.getElementById(
          'showCone'
        ) as HTMLInputElement;
        if (coneCheckbox) {
          coneCheckbox.checked = true;
        }
      }, 100); // Small delay to ensure DOM is ready
    }

    // Subscribe to commercial filter changes
    this.settings.excludeDiscountChanged.subscribe(() => {
      // Re-filter planes when commercial toggle changes
      this.onExcludeDiscountChange();
    });

    this.resultsOverlayComponent.clearHistoricalList.subscribe(() =>
      this.clearSeenList()
    );
    this.resultsOverlayComponent.exportFilterList.subscribe(() =>
      this.exportFilterList()
    );
    this.resultsOverlayComponent.filterPrefix.subscribe(
      (plane: PlaneLogEntry) => {
        const prefix = this.planeFilter.extractAirlinePrefix(plane.callsign);

        // Toggle the prefix in the filter service
        this.planeFilter.togglePrefix(prefix);

        // Find the actual PlaneModel instance in the main log
        const planeModel = this.planeLog.get(plane.icao);
        if (planeModel) {
          // Re-evaluate filter status based on the updated filter list
          const isMilitary =
            this.aircraftDb.lookup(planeModel.icao)?.mil || false;
          const shouldBeFiltered = !this.planeFilter.shouldIncludeCallsign(
            planeModel.callsign,
            this.settings.excludeDiscount,
            this.planeFilter.getFilterPrefixes(),
            isMilitary
          );

          // Update the filteredOut status directly on the model
          planeModel.filteredOut = shouldBeFiltered; // --- Handle Visuals ---
          if (shouldBeFiltered) {
            planeModel.removeVisuals(this.map);
          } else if (
            planeModel.marker &&
            !this.map.hasLayer(planeModel.marker)
          ) {
            planeModel.marker.addTo(this.map);
          }
        }

        // --- REMOVED to prevent infinite loop ---

        // Trigger change detection manually as we mutated an object property
        // which might not be picked up by default change detection strategy.
        this.cdr.detectChanges();
        // Also update filteredOut flag on historical entries for the seen list
        this.planeHistoricalLog.forEach((hist) => {
          const isMilHist = this.aircraftDb.lookup(hist.icao)?.mil || false;
          hist.filteredOut = !this.planeFilter.shouldIncludeCallsign(
            hist.callsign,
            this.settings.excludeDiscount,
            this.planeFilter.getFilterPrefixes(),
            isMilHist
          );
        });
        // Rebuild logs to refresh seen list
        this.updatePlaneLog(Array.from(this.planeLog.values()));
      }
    );

    this.scanService.start(this.settings.interval, () => {
      this.findPlanes();
    });
    // Don't force scan here, updateMap will trigger it after airport search
    // this.scanService.forceScan(); // REMOVED

    // Subscribe to radius changes: clear markers and paths outside new radius
    this.settings.radiusChanged.subscribe((newRadius) => {
      // Get current center coordinates
      const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
      const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];

      // Redraw the main radius circle without re-centering
      this.mapService.setMainRadius(lat, lon, newRadius);

      // Remove planes outside new radius and update airports
      this.removeOutOfRangePlanes(lat, lon, newRadius);
      this.findAndDisplayAirports(lat, lon, newRadius);
    });

    // Initialize map panning service
    this.mapPanService.init(this.map); // Initialize sun angle overlay and kick off periodic updates
    this.updateSunAngle();
    // note: initial wind fetch occurs in updateMap, so no extra one here
    this.sunAngleInterval = setInterval(() => {
      this.updateSunAngle();
      // Update wind direction periodically
      const center = this.map.getCenter();
      this.fetchWindDirection(center.lat, center.lng);
      this.cdr.detectChanges();
    }, 60000); // update every minute

    // Subscribe to sky color changes for cloud layer synchronization
    this.skyColorSyncService.skyColors$.subscribe((skyColors) => {
      if (skyColors && this.cloudLayer) {
        this.applySkyColorsToCloudLayer(skyColors);
      }
    });
  }

  ngOnDestroy(): void {
    this.scanService.stop();
    this.mapPanService.destroy();
    // Clean up airport circles
    this.airportCircles.forEach((circle) => circle.remove());
    this.airportCircles.clear();
    if (this.svgPatternRetryTimeout) {
      clearTimeout(this.svgPatternRetryTimeout);
    }
    if (this.sunAngleInterval) {
      clearInterval(this.sunAngleInterval);
    }
    if (this.cloudLayer) {
      this.cloudLayer.remove();
    }
    if (this.rainLayer) {
      this.rainLayer.remove();
    }
    window.removeEventListener('click', this.globalTooltipClickHandler);
  }

  private initMap(lat: number, lon: number, radius: number): void {
    this.map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    }).setView([lat, lon], 12);

    // Disable CD for frequent panning events, only toggle class inside Angular when needed
    this.ngZone.runOutsideAngular(() => {
      this.map.on('movestart', () =>
        this.ngZone.run(() => (this.panning = true))
      );
      this.map.on('moveend', () =>
        this.ngZone.run(() => (this.panning = false))
      );
    });

    // Add SVG renderer for vector overlays (draws into overlayPane)
    L.svg().addTo(this.map);

    // Create a custom pane for followed markers and set its zIndex above markerPane
    this.map.createPane('followedMarkerPane');
    const followedPane = this.map.getPane('followedMarkerPane') as HTMLElement;
    followedPane.style.zIndex = '610';
    followedPane.style.pointerEvents = 'auto'; // Define airport striped patterns in overlayPane's SVG
    const overlaySvg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement | null;
    if (overlaySvg) {
      ensureStripedPattern(
        overlaySvg,
        'airportStripedPatternCyan',
        'cyan',
        0.5
      );
      ensureStripedPattern(
        overlaySvg,
        'airportStripedPatternGold',
        'gold',
        0.5
      );
    }

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    // Create a custom pane for cloud coverage above markers
    this.map.createPane('cloudPane');
    const cloudPane = this.map.getPane('cloudPane') as HTMLElement;
    cloudPane.style.zIndex = '620';
    cloudPane.style.pointerEvents = 'none';

    // Create a custom pane for rain coverage above markers, below clouds
    this.map.createPane('rainPane');
    const rainPane = this.map.getPane('rainPane') as HTMLElement;
    rainPane.style.zIndex = '615'; // Below cloudPane (620)
    rainPane.style.pointerEvents = 'none';

    // Cloud coverage overlay from OpenWeatherMap in the cloudPane
    this.cloudLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
      {
        pane: 'cloudPane',
        className: 'cloud-layer',
        opacity: this.cloudOpacity,
        attribution: 'Weather data © OpenWeatherMap',
      }
    )
      .addTo(this.map)
      .on('tileerror', () => {
        // ignore cloud tile errors in console
      });

    // Rain coverage overlay from OpenWeatherMap in the rainPane
    this.rainLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
      {
        pane: 'rainPane',
        className: 'rain-layer',
        opacity: this.rainOpacity, // Use the rainOpacity property
        attribution: 'Weather data © OpenWeatherMap',
      }
    )
      .addTo(this.map)
      .on('tileerror', () => {
        // ignore rain tile errors in console
      });

    // Create custom marker for current location
    const locationIcon = L.divIcon({
      className: 'current-location-marker',
      html: '<span class="material-symbols-outlined">location_on</span>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    this.currentLocationMarker = L.marker([lat, lon], {
      icon: locationIcon,
    }).addTo(this.map);

    // Check if we're at home location and hide the current marker if so
    this.updateMarkersVisibility(lat, lon); // Remove direct rendering of the main radius here. The RadiusComponent handles the main radius.
    // const mainRadiusCircle = L.circle([lat, lon], { ... }).addTo(this.map);

    this.map.on('dblclick', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      // Use the current main radius for the update
      const currentMainRadius = this.settings.radius ?? 5;
      this.updateMap(lat, lng, currentMainRadius); // This will trigger airport search

      // Hide the cone when double-clicking to a new location
      this.coneVisible = false;

      // Update the Show View Axes checkbox to match
      const coneCheckbox = document.getElementById(
        'showCone'
      ) as HTMLInputElement;
      if (coneCheckbox) {
        coneCheckbox.checked = false;
      }

      this.reverseGeocode(lat, lng).then((address) => {
        // Guard against missing input reference
        if (this.inputOverlayComponent.addressInputRef?.nativeElement) {
          this.inputOverlayComponent.addressInputRef.nativeElement.value =
            address;
        }
      });
      this.scanService.forceScan(); // Restart the scan
    });

    // NOTE: disabling auto-loading indicator on map move/zoom to avoid overriding airport loading
    // this.map.on('movestart zoomstart', () => this.ngZone.run(() => (this.loadingAirports = true)));
    // this.map.on('moveend zoomend', () => this.ngZone.run(() => (this.loadingAirports = false)));
  }

  private attemptAddSvgPattern(): void {
    const overlayPane = this.map?.getPanes()?.overlayPane;
    const svg = overlayPane?.querySelector('svg') as SVGSVGElement | null;

    if (svg) {
      // SVG is ready, add the pattern definition
      const defs =
        svg.querySelector('defs') ||
        document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const patternId = 'diagonalHatch';
      if (!defs.querySelector(`#${patternId}`)) {
        const pattern = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'pattern'
        );
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '8');
        pattern.setAttribute('height', '8');
        pattern.innerHTML = `<path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" style="stroke:rgba(255,0,0,0.5); stroke-width:1"/>`;
        defs.appendChild(pattern);

        // Ensure defs is part of the SVG
        if (!svg.contains(defs)) {
          svg.insertBefore(defs, svg.firstChild);
        }
      }
      // Clear any pending retry timeout if we succeeded
      if (this.svgPatternRetryTimeout) {
        clearTimeout(this.svgPatternRetryTimeout);
        this.svgPatternRetryTimeout = null;
      }
    } else {
      // SVG not ready, schedule a retry

      // Clear existing timeout before setting a new one
      if (this.svgPatternRetryTimeout) {
        clearTimeout(this.svgPatternRetryTimeout);
      }
      this.svgPatternRetryTimeout = setTimeout(() => {
        this.attemptAddSvgPattern();
      }, 150); // Retry after 150ms
    }
  }

  // Initialize home marker if home location exists
  private initHomeMarker(): void {
    const homeLocation = this.settings.getHomeLocation();
    if (homeLocation) {
      this.setHomeMarker(homeLocation.lat, homeLocation.lon);

      // Check if we're at home location
      if (this.settings.lat !== null && this.settings.lon !== null) {
        this.updateMarkersVisibility(this.settings.lat, this.settings.lon);
      }
    }
  }

  // Update markers visibility based on current location
  private updateMarkersVisibility(lat: number, lon: number): void {
    const homeLocation = this.settings.getHomeLocation();
    if (homeLocation) {
      // If we're at the home location (within a small tolerance)
      const atHome =
        Math.abs(lat - homeLocation.lat) < 0.0001 &&
        Math.abs(lon - homeLocation.lon) < 0.0001;

      if (atHome && this.currentLocationMarker) {
        this.currentLocationMarker.remove(); // Remove current location marker when at home
      } else if (
        !atHome &&
        this.currentLocationMarker &&
        !this.map.hasLayer(this.currentLocationMarker)
      ) {
        this.currentLocationMarker.addTo(this.map); // Restore current location marker when not at home
      }
    }
  }

  // Set a marker for the home location
  private setHomeMarker(lat: number, lon: number): void {
    // Remove previous home marker if it exists
    if (this.homeMarker) {
      this.homeMarker.remove();
    }

    // Create custom home icon
    const homeIcon = L.divIcon({
      className: 'home-marker',
      html: '<span class="material-symbols-outlined">home</span>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    // Add new home marker
    this.homeMarker = L.marker([lat, lon], { icon: homeIcon }).addTo(this.map);
  }

  // Set current location as home
  setCurrentAsHome(): void {
    const lat = this.settings.lat;
    const lon = this.settings.lon;

    if (lat !== null && lon !== null) {
      // Save home location to settings
      this.settings.setHomeLocation(lat, lon);

      // Set home marker on map
      this.setHomeMarker(lat, lon);

      // Update markers visibility
      this.updateMarkersVisibility(lat, lon);
    }
  }

  // Go to home location
  goToHome(): void {
    const homeLocation = this.settings.getHomeLocation();
    if (homeLocation) {
      // Show the cone when going home
      this.coneVisible = true;

      // Update the Show View Axes checkbox to match
      const coneCheckbox = document.getElementById(
        'showCone'
      ) as HTMLInputElement;
      if (coneCheckbox) {
        coneCheckbox.checked = true;
      }

      // Use current radius and settings
      const radius = this.settings.radius ?? 5;
      this.updateMap(homeLocation.lat, homeLocation.lon, radius);
    }
  }

  /** Central update function */
  updateMap(
    lat: number,
    lon: number,
    radiusKm?: number, // This is the MAIN search radius
    zoomLevel?: number
  ): void {
    // Clamp radius to a maximum of 500km
    let mainRadius = radiusKm ?? this.settings.radius ?? 5;
    if (mainRadius > 500) {
      mainRadius = 500;
    }
    this.settings.setLat(lat);
    this.settings.setLon(lon);
    this.settings.setRadius(mainRadius); // Set the MAIN radius
    this.manualUpdate = true;
    // Update view first to recalc internal transforms, keep current zoom if none provided
    const targetZoom = zoomLevel != null ? zoomLevel : this.map.getZoom();
    this.map.setView([lat, lon], targetZoom);

    // Then draw main radius so it projects correctly
    this.mapService.setMainRadius(lat, lon, mainRadius);

    // Update current marker position (but keep it removed if at home)
    this.currentLocationMarker.setLatLng([lat, lon]);

    // Update markers visibility based on new location
    this.updateMarkersVisibility(lat, lon);

    // Load planes immediately for faster UX
    this.findPlanes();

    // Only update input fields if overlay is not collapsed and refs exist
    if (!this.inputOverlayComponent.collapsed) {
      // Update search radius input
      if (this.inputOverlayComponent.searchRadiusInputRef?.nativeElement) {
        this.inputOverlayComponent.searchRadiusInputRef.nativeElement.value =
          String(mainRadius);
      }
      // Reverse geocode current center and update address input
      const addressInput =
        this.inputOverlayComponent.addressInputRef?.nativeElement;
      if (addressInput) {
        this.reverseGeocode(lat, lon).then((address) => {
          addressInput.value = address;
        });
      }
    }

    // Find airports within the new MAIN radius
    this.findAndDisplayAirports(lat, lon, mainRadius).then(() => {
      // Only after airports are potentially updated, remove out-of-range planes
      // and force a plane scan.
      this.removeOutOfRangePlanes(lat, lon, mainRadius);

      // Prevent double scan on initial load: only force scan if not immediately after ngAfterViewInit
      if (!this._initialScanDone) {
        this._initialScanDone = true;
      } else {
        this.scanService.forceScan();
      }
    }); // fetch and update current wind direction
    this.fetchWindDirection(lat, lon);

    // Update location context for explicit location changes (not map panning)
    this.locationContextService.updateFromMapCenter(lat, lon);
  }

  /** Fetch wind direction from OpenWeatherMap and update windAngle */
  private fetchWindDirection(lat: number, lon: number): void {
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_MAP_API_KEY}`
    )
      .then((res) => {
        if (res.status === 429) {
          // Too Many Requests: skip update, optionally show warning
          // Rate limit warning would be logged here
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // skip if rate-limited
        // debug wind values from API
        const speed = data.wind?.speed ?? 0;
        this.windSpeed = speed;
        const windFrom = data.wind?.deg ?? 0;
        // compute stat 0-3 based on speed
        let stat = 0;
        if (speed >= 6) stat = 3;
        else if (speed >= 3) stat = 2;
        else if (speed >= 0.5) stat = 1;
        // update both intensity stat and wind direction
        this.windStat = stat;
        this.windAngle = windFrom;
        this.cdr.detectChanges();
      });
  }
  /** Convert wind direction in degrees to compass point (e.g. N, NE, E, etc.) */
  public getWindFromDirection(deg: number): string {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const index = Math.round((deg % 360) / 22.5);
    return directions[index % directions.length];
  }

  /** Convert wind speed from m/s to the specified unit */
  public convertWindSpeed(speedMs: number, unit: string): number {
    switch (unit) {
      case 'knots':
        return speedMs * 1.94384; // m/s to knots
      case 'km/h':
        return speedMs * 3.6; // m/s to km/h
      case 'mph':
        return speedMs * 2.23694; // m/s to mph
      case 'm/s':
      default:
        return speedMs;
    }
  }

  /** Get the current wind speed in the selected unit */
  public getCurrentWindSpeed(): number {
    return this.convertWindSpeed(
      this.windSpeed,
      this.windUnits[this.currentWindUnitIndex]
    );
  }

  /** Get the current wind unit string */
  public getCurrentWindUnit(): string {
    return this.windUnits[this.currentWindUnitIndex];
  }

  /** Cycle to the next wind unit */
  public cycleWindUnit(): void {
    this.currentWindUnitIndex =
      (this.currentWindUnitIndex + 1) % this.windUnits.length;
  }

  removeOutOfRangePlanes(lat: number, lon: number, radius: number): void {
    for (const [icao, plane] of this.planeLog.entries()) {
      if (
        plane.lat == null ||
        plane.lon == null ||
        haversineDistance(lat, lon, plane.lat, plane.lon) > radius
      ) {
        plane.removeVisuals(this.map);
        this.planeLog.delete(icao);
      }
    }
    // Update the set of active plane ICAOs after removal
    this.activePlaneIcaos = new Set(this.planeLog.keys());
    this.updatePlaneLog(Array.from(this.planeLog.values()));
  }
  reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }

  // Helper to check if alert should be muted
  shouldMuteCommercialAlert(newUnfiltered: PlaneModel[]): boolean {
    // If mute is enabled, only commercial planes are present, and all new planes are commercial, mute the alert
    if (!this.resultsOverlayComponent) return false;
    if (!this.resultsOverlayComponent.commercialMute) return false;
    if (!this.resultsOverlayComponent.onlyCommercial) return false;
    // If all new planes are non-military (commercial), mute
    return newUnfiltered.every((p) => !this.aircraftDb.lookup(p.icao)?.mil);
  }

  findPlanes(): void {
    const previousPlaneKeys = new Set(this.planeLog.keys());
    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;
    const exclude = this.settings.excludeDiscount;

    this.planeFinder
      .findPlanes(
        this.map,
        lat,
        lon,
        radius,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        this.planeNewTimestamps,
        (origin) => this.countryService.getFlagHTML(origin),
        this.manualUpdate,
        () => {},
        (icao) => {
          const record = this.aircraftDb.lookup(icao);
          return record
            ? { model: record.model, ownop: record.ownop, mil: record.mil }
            : null;
        },
        this.planeLog as Map<string, PlaneModel>,
        this.highlightedPlaneIcao, // pass followed ICAO
        this.followNearest // pass followNearest
      )
      .then(({ anyNew, currentIDs, updatedLog }) => {
        // Dynamically update favicon if special or military plane detected
        const hasSpecial = updatedLog.some((p) =>
          this.specialListService.isSpecial(p.icao)
        );
        const hasMil = updatedLog.some(
          (p) => !!this.aircraftDb.lookup(p.icao)?.mil
        );
        const iconToUse = hasSpecial
          ? 'assets/favicon/special/favicon.ico'
          : hasMil
          ? 'assets/favicon/military/favicon.ico'
          : 'assets/favicon/favicon.ico';
        this.updateFavicon(iconToUse);

        const newUnfiltered = updatedLog.filter(
          (p) => p.isNew && !p.filteredOut
        );
        // Alert on any new visible plane, but suppress only when hide-commercial filter and commercial mute are both on and all new are commercial
        const newVisible = updatedLog.filter((p) => p.isNew && !p.filteredOut);
        // Determine if any new visible plane is a Hercules model
        const hasHercules = newVisible.some((p) =>
          p.model?.toLowerCase().includes('hercules')
        );
        // Determine if any other alert-worthy planes (military or special)
        const hasAlertPlanes = newVisible.some(
          (p) =>
            this.aircraftDb.lookup(p.icao)?.mil ||
            this.specialListService.isSpecial(p.icao)
        );
        // Play appropriate alert sound: Hercules priority
        if (hasHercules) {
          playHerculesAlert();
        } else if (hasAlertPlanes) {
          playAlertSound();
        }
        const existing = new Set(currentIDs);
        for (const [id, plane] of this.planeLog.entries()) {
          if (!existing.has(id)) {
            plane.removeVisuals(this.map);
            this.planeLog.delete(id);
          }
        }

        // Convert all planes to PlaneModel first
        const isPlaneModel = (p: any): p is PlaneModel =>
          p && typeof p.updateFrom === 'function';
        const updatedPlaneModels = updatedLog.map((p) =>
          isPlaneModel(p) ? p : new PlaneModel(p)
        );

        for (const planeModel of updatedPlaneModels) {
          // If it's in planeLog from the previous scan, it's not new now
          planeModel.isNew = !previousPlaneKeys.has(planeModel.icao);

          // Determine military status via DB or configured prefixes
          const dbMil = this.aircraftDb.lookup(planeModel.icao)?.mil || false;
          const prefixMil = this.militaryPrefixService.isMilitaryCallsign(
            planeModel.callsign
          );
          const isMilitary = dbMil || prefixMil;
          // propagate to model
          planeModel.isMilitary = isMilitary;
          planeModel.filteredOut = !this.planeFilter.shouldIncludeCallsign(
            planeModel.callsign,
            exclude,
            this.planeFilter.getFilterPrefixes(),
            isMilitary
          );

          // Handle visuals based on filter status
          if (planeModel.filteredOut) {
            // Use the new helper method to remove all visuals for filtered planes
            planeModel.removeVisuals(this.map);
          } else {
            // If not filtered, proceed with marker/tooltip updates if marker exists
            if (planeModel.marker) {
              if (planeModel.onGround) {
                planeModel.marker.getElement()?.classList.add('grounded-plane');
                planeModel.marker
                  .getElement()
                  ?.classList.remove('new-plane', 'military-plane');
                // Ensure tooltip reflects grounded state if needed (optional, depends on styling)
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.add('grounded-plane-tooltip'); // Assuming this class exists
              } else {
                // Not new and not on ground
                planeModel.marker
                  .getElement()
                  ?.classList.remove('new-plane', 'grounded-plane');
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.remove(
                    'new-plane-tooltip',
                    'grounded-plane-tooltip'
                  );
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.remove('new-plane-tooltip');
                // Marker and tooltip for military override new-plane
                if (isMilitary) {
                  planeModel.marker
                    .getElement()
                    ?.classList.add('military-plane');
                  // Always set military border for tooltip
                  planeModel.marker
                    .getTooltip()
                    ?.getElement()
                    ?.classList.add('military-plane-tooltip');
                  // Remove new-plane-tooltip if present
                  planeModel.marker
                    .getTooltip()
                    ?.getElement()
                    ?.classList.remove('new-plane-tooltip');
                } else {
                  planeModel.marker
                    .getElement()
                    ?.classList.remove('military-plane');
                }
                // Tooltips handled above
              }
            }
          }
          // --- Set tooltip classes for new planes (not grounded) ---
          if (planeModel.marker && planeModel.marker.getTooltip()) {
            const tooltipEl = planeModel.marker.getTooltip()?.getElement();
            if (tooltipEl) {
              tooltipEl.classList.toggle('new-plane-tooltip', planeModel.isNew);
            }
          }
          // Always update the log regardless of filter status
          this.planeLog.set(planeModel.icao, planeModel);
        }

        // Update the set of active plane ICAOs
        this.activePlaneIcaos = new Set(this.planeLog.keys());

        // Update both the overlay and lists via updatePlaneLog
        this.updatePlaneLog(updatedPlaneModels);
        // Update the closest-plane-overlay with latest distance/operator/ETA info
        this.computeClosestPlane();
        this.manualUpdate = false;
        // Reapply tooltip highlight after updates if a plane is followed
        if (this.highlightedPlaneIcao) {
          const pm = this.planeLog.get(this.highlightedPlaneIcao);
          const tooltipEl = pm?.marker?.getTooltip()?.getElement();
          tooltipEl?.classList.add('highlighted-tooltip');
        }
        this.cdr.detectChanges();
      })
      .catch((err) => {
        // Error in findPlanes would be logged here
      });
  }

  /** Compute and update the overlay to show the nearest plane (or tracked) */
  private computeClosestPlane(): void {
    const centerLat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const centerLon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    // Use PlaneModel entries from planeLog
    let candidate: PlaneModel | undefined;
    if (this.followNearest && this.highlightedPlaneIcao) {
      candidate = this.planeLog.get(this.highlightedPlaneIcao) || undefined;
    }
    if (!candidate) {
      let minDist = Infinity;
      for (const plane of this.planeLog.values()) {
        if (plane.filteredOut || plane.lat == null || plane.lon == null)
          continue;
        const d = haversineDistance(centerLat, centerLon, plane.lat, plane.lon);
        if (d < minDist) {
          minDist = d;
          candidate = plane;
        }
      }
    }
    if (!candidate) {
      this.closestPlane = null;
      this.closestDistance = null;
      this.closestOperator = null;
      this.closestSecondsAway = null;
      this.closestVelocity = null;
      return;
    }
    // Update overlay with selected candidate
    this.closestPlane = candidate;
    const dist = haversineDistance(
      centerLat,
      centerLon,
      candidate.lat!,
      candidate.lon!
    );
    this.closestDistance = Math.round(dist * 10) / 10;

    this.closestOperator = candidate.operator || null;
    // Only show ETA if velocity >= 200
    const vel = candidate.velocity ?? null;
    if (vel != null && vel >= 200) {
      this.closestVelocity = vel;
      this.closestSecondsAway = Math.round((dist * 1000) / vel);
    } else {
      this.closestVelocity = null;
      this.closestSecondsAway = null;
    } // Always update location information for the closest plane,
    // even if we're not following it yet
    if (candidate && candidate.lat !== null && candidate.lon !== null) {
      this.reverseGeocode(candidate.lat, candidate.lon).then((address) => {
        if (!address || address.trim() === '') {
          console.log('Empty geocoding result for closest plane:', address);
        }
        this.locationStreet = address;
        this.locationDistrict = address;
        if (!this.locationDistrict || this.locationDistrict.trim() === '') {
          console.log(
            'locationDistrict is empty after setting:',
            this.locationDistrict
          );
        }
        this.cdr.detectChanges();
      });
    }
  }

  /** Replace favicon by updating the href of the <link rel="icon"> tag */
  private updateFavicon(iconUrl: string): void {
    // Only update when icon URL changes
    if (this.currentFaviconUrl === iconUrl) {
      return;
    }
    this.currentFaviconUrl = iconUrl;
    const linkSelectors = [
      "link[rel='icon']",
      "link[rel='shortcut icon']",
    ].join(',');
    const links =
      this.document.querySelectorAll<HTMLLinkElement>(linkSelectors);
    if (!links.length) {
      // No favicon link tags found warning would be logged here
      return;
    }
    links.forEach((link) => {
      link.href = iconUrl;
    });
  }

  /** Update followed styles for all planes based on current follow state */
  private updateFollowedStyles(): void {
    for (const plane of this.planeLog.values()) {
      const marker = plane.marker;
      if (marker) {
        const markerEl = marker.getElement();
        const tooltipEl = marker.getTooltip()?.getElement();
        // Always remove followed styles first
        markerEl?.classList.remove('highlighted-marker');
        if (tooltipEl) {
          tooltipEl.classList.remove('highlighted-tooltip');
          tooltipEl.classList.remove('followed-plane-tooltip');
        }
        marker.setZIndexOffset(0);
      }
    }
    // Now apply followed style to the currently followed plane only
    if (this.followNearest && this.highlightedPlaneIcao) {
      const followed = this.planeLog.get(this.highlightedPlaneIcao);
      if (followed && followed.marker) {
        const markerEl = followed.marker.getElement();
        const tooltipEl = followed.marker.getTooltip()?.getElement();
        followed.marker.setZIndexOffset(20000);
        markerEl?.classList.add('highlighted-marker');
        // Add followed-plane class for cyan border unless military or special
        if (
          markerEl &&
          !markerEl.classList.contains('military-plane') &&
          !markerEl.classList.contains('special-plane')
        ) {
          markerEl.classList.add('followed-plane');
        }
        if (tooltipEl) {
          tooltipEl.classList.add('highlighted-tooltip');
          tooltipEl.classList.add('followed-plane-tooltip');
        }
      }
    }
  }

  // Add window view markers for cone boundaries and midpoints
  private updateWindowViewMarkers(): void {
    // Define the azimuth ranges directly matching ConeComponent angles
    const cones = [
      { label: 'Balcony', start: 75, end: 190 }, // ENE to S
      { label: 'Streetside', start: 245, end: 345 }, // SW to N
    ];
    // Use a fixed radius for window view markers (e.g., 10km)
    const markerRadiusKm = 10;
    // Get home location as the anchor
    const home = this.homeLocationValue;
    if (!home) return;
    const lat = home.lat;
    const lon = home.lon;
    // Helper to convert azimuth (deg, 0=N) to window view x (0-100, 0=left, 100=right)
    // 0° = North at center (50), 90° E at right (75), 270° W at left (25)
    const azToX = (az: number) => (((az + 180) % 360) / 360) * 100;
    // Helper to convert azimuth to compass direction
    const azToCompass = (az: number) => {
      const dirs = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
      ];
      return dirs[Math.round((az % 360) / 22.5) % 16];
    };
    // Helper to convert radius to y (altitude) for window view (fixed at 10km)
    const y = (10 / 12) * 70; // 10km out of 12km max altitude (scaled down to avoid clipping)    // Build marker objects
    const markers = cones.flatMap(({ label, start, end }) => {
      const mid = (start + end) / 2;
      const width = (end - start + 360) % 360;
      return [
        {
          x: azToX(start),
          y,
          callsign: `${label} Start`,
          altitude: -1, // negative altitude to indicate not a real plane
          isMarker: true,
          azimuth: start,
          compass: azToCompass(start),
          icao: `marker-${label}-start`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(mid),
          y,
          callsign: label,
          altitude: -1,
          isMarker: true,
          azimuth: mid,
          compass: azToCompass(mid),
          icao: `marker-${label}-mid`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(end),
          y,
          callsign: `${label} End`,
          altitude: -1,
          isMarker: true,
          azimuth: end,
          compass: azToCompass(end),
          icao: `marker-${label}-end`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
      ];
    });
    // Merge with actual planes for overlay, preserving all real planes (including grounded) and adding markers
    this.windowViewPlanes = [
      // keep only real plane entries (exclude marker objects)
      ...this.windowViewPlanes.filter((p) => !p.isMarker),
      // then append marker entries
      ...markers,
    ];
  }

  private updatePlaneLog(planes: PlaneModel[]): void {
    // Assign airport code/name for planes within airport circles
    planes.forEach((p) => {
      p.airportCode = undefined;
      p.airportName = undefined;
    });
    // Get current center for distance calculations
    const centerLat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const centerLon = this.settings.lon ?? this.DEFAULT_COORDS[1];

    this.airportCircles.forEach((circle, id) => {
      const center = circle.getLatLng();
      const radiusMeters = circle.getRadius();
      planes.forEach((p) => {
        if (p.lat != null && p.lon != null && p.airportCode == null) {
          const dist =
            haversineDistance(p.lat, p.lon, center.lat, center.lng) * 1000;
          // allow assignment for planes within circle or within 3km outside
          if (dist <= radiusMeters + 3000) {
            const data = this.airportData.get(id);
            if (data) {
              p.airportCode = data.code || undefined;
              p.airportName = data.name;
              p.airportLat = center.lat;
              p.airportLon = center.lng;
            }
          }
        }
      });
    });
    const visiblePlanes = planes.filter(
      (p) => !p.filteredOut && p.lat != null && p.lon != null
    );
    // Sort sky list by firstSeen for display (newest bottom)
    visiblePlanes.sort((a, b) => a.firstSeen - b.firstSeen);
    this.resultsOverlayComponent.skyPlaneLog =
      visiblePlanes as unknown as PlaneLogEntry[];
    // Show planes at airports (those with assigned airportCode)
    const airportPlanes = visiblePlanes.filter((p) => p.airportCode != null);
    this.resultsOverlayComponent.airportPlaneLog =
      airportPlanes as unknown as PlaneLogEntry[];

    // Update the window view overlay with airborne planes only
    this.windowViewPlanes = visiblePlanes
      // include grounded planes as well
      .filter((p) => (p.altitude ?? 0) > 0 || p.onGround)
      .map((plane) => {
        const isGrounded = !!plane.onGround;
        // Calculate azimuth (bearing) from homeLocation to plane
        const azimuth = this.calculateAzimuth(
          this.settings.lat ?? this.DEFAULT_COORDS[0],
          this.settings.lon ?? this.DEFAULT_COORDS[1],
          plane.lat,
          plane.lon
        ); // 0 = North, 90 = East, etc.
        const azimuthFromSouth = (azimuth + 180) % 360;
        const x = (azimuthFromSouth / 360) * 100; // Altitude: map 0-20000m to 0-100% (cap at 20km, consistent with window view visual scale)
        // For grounded planes, use 0 altitude for consistency
        const alt = isGrounded ? 0 : plane.altitude ?? 0;
        const y = (Math.min(alt, 20000) / 20000) * 100;
        const iconData = getIconPathForModel(plane.model);
        // Calculate scale, distance
        const distKm = haversineDistance(
          centerLat,
          centerLon,
          plane.lat!,
          plane.lon!
        );
        const maxRadius = this.settings.radius ?? 5; // fallback radius in km
        // scale from 1 at center to 0.5 at max radius
        const scale = Math.max(0.5, 1 - (distKm / maxRadius) * 0.5);
        // Compute history positions for window view
        const rawHistory = computeWindowHistoryPositions(
          plane.positionHistory,
          centerLat,
          centerLon
        );
        const historyTrail = rawHistory.map((hp, idx, arr) => ({
          x: hp.x,
          y: hp.y,
          opacity: 0.1 + (0.9 * idx) / (arr.length - 1 || 1),
        }));
        return {
          x,
          y,
          callsign: plane.callsign || '',
          altitude: alt,
          lat: plane.lat!,
          lon: plane.lon!,
          bearing: plane.track ?? 0,
          iconPath: iconData.path,
          iconType: iconData.iconType,
          isHelicopter: this.helicopterIdentificationService.isHelicopter(
            plane.icao,
            plane.model
          ),
          velocity: plane.velocity ?? 0,
          // historical trail for window view
          historyTrail,
          scale,
          distanceKm: distKm,
          isNew: plane.isNew,
          isMilitary: plane.isMilitary,
          isSpecial: plane.isSpecial,
          icao: plane.icao, // for type safety
          origin: plane.origin, // Origin country for flag display
          isGrounded,
        };
      });
    // Add window view markers for cone boundaries and midpoints
    this.updateWindowViewMarkers();

    // Merge into historical log
    const mergedMap = new Map<string, PlaneModel>();
    // Add existing historical planes first
    for (const plane of this.planeHistoricalLog) {
      mergedMap.set(plane.icao, plane);
    }
    // Add/update with current planes (including their filteredOut status)
    for (const plane of planes) {
      mergedMap.set(plane.icao, plane);
    }
    // Store the full merged list, including filtered items
    this.planeHistoricalLog = Array.from(mergedMap.values());

    // Sort the full historical log chronologically (most recent first)
    this.planeHistoricalLog.sort((a, b) => b.firstSeen - a.firstSeen);
    // Build seen list: sort by recency and prioritize military
    const historyFiltered = this.planeHistoricalLog
      .filter((p) => !p.filteredOut)
      .sort((a, b) => b.firstSeen - a.firstSeen);
    const militaryPlanes = historyFiltered.filter((p) => p.isMilitary);
    const otherPlanes = historyFiltered.filter((p) => !p.isMilitary);
    this.resultsOverlayComponent.seenPlaneLog = [
      ...militaryPlanes,
      ...otherPlanes,
    ] as unknown as PlaneLogEntry[];

    // Store the current followed ICAO to check if we need to find a replacement
    const wasFollowing = this.followNearest && this.highlightedPlaneIcao;
    const previousFollowedIcao = this.highlightedPlaneIcao;

    // Only clear follow state if the followed plane is gone and not in shuffle mode
    if (this.followNearest && this.highlightedPlaneIcao) {
      // Check if this is a shuffle-followed plane by looking for a property on the results component
      const isShuffleMode = this.resultsOverlayComponent.shuffleMode;

      if (!this.planeLog.has(this.highlightedPlaneIcao)) {
        if (isShuffleMode) {
          // In shuffle mode, we need to pick a new plane instead of unfollowing
          // Shuffle-followed plane lost, requesting new shuffle would be logged here
          // Trigger a new shuffle via the component (will pick a new plane)
          this.ngZone.run(() => {
            setTimeout(() => {
              this.resultsOverlayComponent.triggerNewShuffle();
            }, 100);
          });
        } else {
          // Normal mode - unfollow if plane is gone
          // Followed plane lost, clearing follow state would be logged here
          this.followNearest = false;
          this.highlightedPlaneIcao = null;
        }
      }
    }

    this.updateFollowedStyles(); // <-- ensure all planes update
  }

  clearSeenList(): void {
    this.planeHistoricalLog = [];
    this.resultsOverlayComponent.seenPlaneLog = [];
    this.cdr.detectChanges();
  }

  exportFilterList(): void {
    const filters = this.planeFilter.getFilterPrefixes();
    localStorage.setItem('filterList', JSON.stringify(filters));
    const data = JSON.stringify(filters, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filter-list.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  useCurrentLocation(): void {
    // Hide the cone when navigating to current location
    this.coneVisible = false;

    // Update the Show View Axes checkbox to match
    const coneCheckbox = document.getElementById(
      'showCone'
    ) as HTMLInputElement;
    if (coneCheckbox) {
      coneCheckbox.checked = false;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // reset error flag on success and update map
          this.locationErrorShown = false;
          // Use current main radius for update
          const currentMainRadius = this.settings.radius ?? 5;
          this.updateMap(
            position.coords.latitude,
            position.coords.longitude,
            currentMainRadius // Pass main radius
          ); // Triggers airport search
        },
        (error) => {
          if (!this.locationErrorShown) {
            // Fallback to default coordinates
            // Use current main radius for fallback update
            const currentMainRadius = this.settings.radius ?? 5;
            this.updateMap(
              this.DEFAULT_COORDS[0],
              this.DEFAULT_COORDS[1],
              currentMainRadius // Pass main radius
            ); // Triggers airport search
            this.inputOverlayComponent.addressInputRef.nativeElement.value =
              'Unable to fetch location; using default';
            this.locationErrorShown = true;
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  resolveAndUpdateFromAddress(): void {
    const address =
      this.inputOverlayComponent.addressInputRef.nativeElement.value;
    // Get the MAIN radius from the input, fallback to settings.radius
    const mainRadius = (() => {
      const ref = this.inputOverlayComponent.searchRadiusInputRef;
      const val = ref?.nativeElement?.valueAsNumber;
      return !isNaN(val!) ? val! : this.settings.radius ?? 5;
    })();

    // Check if we're at home location before clearing cones
    const homeLocation = this.settings.getHomeLocation();
    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];

    // Only clear cones if we're not at home
    const atHome =
      homeLocation &&
      Math.abs(lat - homeLocation.lat) < 0.0001 &&
      Math.abs(lon - homeLocation.lon) < 0.0001;

    if (!atHome) {
      // Hide the cone when navigating to a searched address (if not at home)
      this.coneVisible = false;

      // Update the Show View Axes checkbox to match
      const coneCheckbox = document.getElementById(
        'showCone'
      ) as HTMLInputElement;
      if (coneCheckbox) {
        coneCheckbox.checked = false;
      }
    }

    // Set the MAIN radius setting if valid
    if (!isNaN(mainRadius)) {
      this.settings.setRadius(mainRadius);
    } else {
      // Use the current setting if input is invalid
      // mainRadius = this.settings.radius ?? 5; // No need, updateMap handles undefined radiusKm
    }

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.length) {
          const currentZoom = this.map.getZoom(); // Preserve current zoom level
          // Pass the mainRadius obtained from the input (or current setting if invalid)
          this.updateMap(
            parseFloat(data[0].lat),
            parseFloat(data[0].lon),
            mainRadius, // Pass the potentially updated main radius
            currentZoom
          ); // Triggers airport search
        }
      });
    // Always force a scan at the end
    this.scanService.forceScan();
  }

  onExcludeDiscountChange(): void {
    const exclude = this.settings.excludeDiscount;
    // Don't set the property again to avoid infinite loop
    localStorage.setItem('excludeDiscount', exclude.toString());

    // Reset the filteredOut flag for all planes to ensure proper re-evaluation
    for (const plane of this.planeLog.values()) {
      // Get military status
      const isMilitary = this.aircraftDb.lookup(plane.icao)?.mil || false;

      // If commercial filter is OFF (exclude is false), all planes should be shown
      if (!exclude) {
        plane.filteredOut = false;
        if (plane.marker && !this.map.hasLayer(plane.marker)) {
          plane.marker.addTo(this.map);
          if (plane.path) plane.path.addTo(this.map);
          if (plane.predictedPathArrowhead)
            plane.predictedPathArrowhead.addTo(this.map);
          // Re-add history trail segments if they exist
          if (plane.historyTrailSegments) {
            plane.historyTrailSegments.forEach((segment) =>
              segment.addTo(this.map)
            );
          }
        }
        continue;
      }

      // If commercial filter is ON, check if this plane should be filtered
      const isFiltered = !this.planeFilter.shouldIncludeCallsign(
        plane.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        isMilitary
      );

      plane.filteredOut = isFiltered;

      if (isFiltered) {
        // Use the new helper method to remove all visuals
        plane.removeVisuals(this.map);
      } else if (plane.marker && !this.map.hasLayer(plane.marker)) {
        // Only add back if not filtered
        plane.marker.addTo(this.map);
        // Add back path and arrowhead if they exist
        if (plane.path) plane.path.addTo(this.map);
        if (plane.predictedPathArrowhead)
          plane.predictedPathArrowhead.addTo(this.map);
        // Re-add history trail segments if they exist
        if (plane.historyTrailSegments) {
          plane.historyTrailSegments.forEach((segment) =>
            segment.addTo(this.map)
          );
        }
      }
    }

    // Also update the historical log using the same logic
    for (const plane of this.planeHistoricalLog) {
      const isMilitary = this.aircraftDb.lookup(plane.icao)?.mil || false;

      // If commercial filter is OFF (exclude is false), no plane should be filtered
      if (!exclude) {
        plane.filteredOut = false;
        continue;
      }

      // If commercial filter is ON, check if this plane should be filtered
      plane.filteredOut = !this.planeFilter.shouldIncludeCallsign(
        plane.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        isMilitary
      );
      // Note: We don't remove visuals from the historical log directly here,
      // as they are managed by the main planeLog. We just update the flag.
    }

    this.updatePlaneLog(Array.from(this.planeLog.values()));
    this.cdr.detectChanges();
  }
  get currentLat(): number {
    return this.settings.lat ?? this.DEFAULT_COORDS[0];
  }

  get currentLon(): number {
    return this.settings.lon ?? this.DEFAULT_COORDS[1];
  }

  get radiusKm(): number {
    // This getter now returns the MAIN search radius
    return this.settings.radius ?? 5;
  }

  // Get stored home location
  get homeLocationValue(): { lat: number; lon: number } | null {
    return this.settings.getHomeLocation() || null;
  }

  // Check if current view is at home location
  get isAtHome(): boolean {
    const home = this.homeLocationValue;
    if (!home) {
      return false;
    }
    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const tol = 1e-6;
    return Math.abs(lat - home.lat) < tol && Math.abs(lon - home.lon) < tol;
  }

  toggleConeVisibility(show: boolean): void {
    // Show or hide cones regardless of current map view, always anchored at home
    this.coneVisible = show;
    this.settings.setShowViewAxes(show);
  }

  /** Adjust cloud layer opacity */
  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    if (this.cloudLayer) {
      this.cloudLayer.setOpacity(opacity);
    }
  }

  /** Adjust rain layer opacity */
  setRainOpacity(opacity: number): void {
    this.rainOpacity = opacity;
    if (this.rainLayer) {
      this.rainLayer.setOpacity(opacity);
    }
  }

  /** Toggle display of cloud coverage layer */
  toggleCloudCover(show: boolean): void {
    this.cloudVisible = show;
    if (this.cloudLayer) {
      if (show) {
        this.cloudLayer.addTo(this.map);
      } else {
        this.cloudLayer.remove();
      }
    }
    this.settings.setShowCloudCover(show);
  }

  /** Toggle display of rain coverage layer */
  toggleRainCover(show: boolean): void {
    this.rainVisible = show;
    if (this.rainLayer) {
      if (show) {
        this.rainLayer.addTo(this.map);
      } else {
        this.rainLayer.remove();
      }
    }
    this.settings.setShowRainCover(show);
  }

  /** Apply sky colors from window view to cloud layer for visual synchronization */
  private applySkyColorsToCloudLayer(skyColors: {
    bottomColor: string;
    topColor: string;
    timestamp: number;
  }): void {
    if (!this.cloudLayer) return;

    // Create CSS filter effects based on sky colors
    const cloudElements = document.querySelectorAll('.cloud-layer');
    cloudElements.forEach((element) => {
      const el = element as HTMLElement;

      // Apply a subtle color overlay that blends with the sky colors
      // Use CSS filters to tint the cloud layer based on atmospheric conditions
      const filter = this.createCloudLayerFilter(
        skyColors.bottomColor,
        skyColors.topColor
      );
      el.style.filter = filter;
      el.style.mixBlendMode = 'multiply';
    });
  }

  /** Create CSS filter string for cloud layer based on sky colors */
  private createCloudLayerFilter(
    bottomColor: string,
    topColor: string
  ): string {
    // Extract RGB values from the colors
    const bottomRgb = this.extractRgbFromColor(bottomColor);
    const topRgb = this.extractRgbFromColor(topColor);

    if (!bottomRgb || !topRgb) return '';

    // Calculate average color for cloud tinting
    const avgR = Math.round((bottomRgb.r + topRgb.r) / 2);
    const avgG = Math.round((bottomRgb.g + topRgb.g) / 2);
    const avgB = Math.round((bottomRgb.b + topRgb.b) / 2);

    // Calculate brightness and color intensity
    const brightness = (avgR + avgG + avgB) / (3 * 255);
    const saturation = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);

    // Create filter based on atmospheric conditions
    const hueShift = this.calculateHueShift(avgR, avgG, avgB);
    const saturationAdjust = Math.max(
      0.8,
      Math.min(1.2, 1 + (saturation / 255) * 0.3)
    );
    const brightnessAdjust = Math.max(0.7, Math.min(1.3, brightness * 1.2));

    return `hue-rotate(${hueShift}deg) saturate(${saturationAdjust}) brightness(${brightnessAdjust}) contrast(1.1)`;
  }

  /** Extract RGB values from color string */
  private extractRgbFromColor(
    color: string
  ): { r: number; g: number; b: number } | null {
    // Handle various color formats (hex, rgb, rgba)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]),
          g: parseInt(match[1]),
          b: parseInt(match[2]),
        };
      }
    }
    return null;
  }

  /** Calculate hue shift based on RGB values */
  private calculateHueShift(r: number, g: number, b: number): number {
    // Calculate hue shift based on dominant color
    if (r > g && r > b) {
      // Red dominant - sunrise/sunset tones
      return -10 + (g / 255) * 20;
    } else if (b > r && b > g) {
      // Blue dominant - day/night tones
      return 10 - (r / 255) * 20;
    } else {
      // Green or mixed - neutral tones
      return 0;
    }
  }

  /** Remove highlight from a plane's marker and tooltip */
  private unhighlightPlane(icao: string): void {
    const pm = this.planeLog.get(icao);
    if (pm?.marker) {
      const tooltip = pm.marker.getTooltip();
      if (tooltip) {
        const tooltipEl = tooltip.getElement();
        tooltipEl?.classList.remove('highlighted-tooltip');
      }
      const markerEl = pm.marker.getElement();
      markerEl?.classList.remove('highlighted-marker');
      pm.marker.setZIndexOffset(0); // Reset z-index offset
    }
  }

  /** Center the map and toggle highlight on the selected plane. Clears followNearest unless preserveFollowNearest is true. */
  centerOnPlane(
    plane: PlaneLogEntry | PlaneModel,
    preserveFollowNearest = false,
    fromShuffle = false
  ): void {
    // If clicking the already highlighted plane, unfollow it
    if (
      !fromShuffle &&
      this.highlightedPlaneIcao === plane.icao &&
      !preserveFollowNearest
    ) {
      this.unhighlightPlane(plane.icao);
      this.highlightedPlaneIcao = null;
      this.followNearest = false;
      this.updatePlaneLog(Array.from(this.planeLog.values()));
      this.cdr.detectChanges();
      return;
    }
    // When manually centering/following a plane, enable tracking override
    this.followNearest = true;

    const icao = plane.icao;

    if (this.highlightedPlaneIcao) {
      this.unhighlightPlane(this.highlightedPlaneIcao);
    }

    this.highlightedPlaneIcao = icao;
    const pm = this.planeLog.get(icao);
    if (pm?.marker && plane.lat != null && plane.lon != null) {
      // Pan map to plane location without changing zoom
      this.map.panTo([plane.lat, plane.lon]);

      pm.marker.setZIndexOffset(20000);
      pm.marker.openTooltip();
      const tooltip = pm.marker.getTooltip();
      if (tooltip) {
        const tooltipEl = tooltip.getElement();
        tooltipEl?.classList.add('highlighted-tooltip');
      }
      const markerEl = pm.marker.getElement();
      markerEl?.classList.add('highlighted-marker');
      this.reverseGeocode(plane.lat!, plane.lon!).then((address) => {
        // Guard against missing input reference
        if (this.inputOverlayComponent.addressInputRef?.nativeElement) {
          this.inputOverlayComponent.addressInputRef.nativeElement.value =
            address;
        } // Update location overlay info using the same address result
        if (!address || address.trim() === '') {
          console.log('Empty geocoding result for followed plane:', address);
        }
        this.locationDistrict = address;
        if (!this.locationDistrict || this.locationDistrict.trim() === '') {
          console.log(
            'locationDistrict is empty after setting (followed plane):',
            this.locationDistrict
          );
        }
        this.cdr.detectChanges();
      });

      // Refresh logs and overlays
      this.closestPlane = pm;
      this.updatePlaneLog(Array.from(this.planeLog.values()));
      this.cdr.detectChanges();
    } else {
      // Could not highlight plane - marker missing or coordinates invalid would be logged here
    }
  }

  /** Follow and center on overlay-selected nearest plane */
  public followNearestPlane(plane: any): void {
    // If this is a marker (not a real plane), do nothing
    if (plane.isMarker) {
      return;
    }
    const isFromShuffle = !!plane.followMe;
    // Always set followNearest to true for planes from shuffle
    if (isFromShuffle) {
      this.followNearest = true;
      // We need to call centerOnPlane with preserveFollowNearest=false so that
      // it doesn't skip updating the followNearest flag inside centerOnPlane
      this.centerOnPlane(plane, false, true); // pass fromShuffle=true
    } else {
      // For regular plane selection, use the standard behavior
      this.centerOnPlane(plane, false, false);
    }
  }

  /** Handle centering map on selected airport coordinates */
  public onCenterAirport(coords: { lat: number; lon: number }): void {
    // Pan map to airport coordinates
    this.map.panTo([coords.lat, coords.lon]);
  }

  // New function to find and display airports
  async findAndDisplayAirports(
    lat: number,
    lon: number,
    radiusKm: number
  ): Promise<void> {
    if (this.airportsLoading) {
      // findAndDisplayAirports skipped: already loading would be logged here
      return;
    }
    this.airportsLoading = true;
    // findAndDisplayAirports start would be logged here
    this.ngZone.run(() => {
      this.loadingAirports = true;
      this.cdr.detectChanges();
    });

    try {
      // Track runway radius promises to delay spinner hiding
      const radiusPromises: Promise<void>[] = [];

      const radiusMeters = radiusKm * 1000;
      const overpassUrl = 'https://overpass-api.de/api/interpreter';
      // Query for nodes, ways, and relations tagged as aerodromes within the radius
      const query = `
        [out:json][timeout:25];
        (
          node["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
          way["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
                   relation["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
        );
        out center;
      `;

      const response = await fetch(overpassUrl, {
        method: 'POST',
        body: query,
      });
      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.statusText}`);
      }
      const data = await response.json();

      const foundAirportIds = new Set<number>();

      for (const element of data.elements || []) {
        if (element.type === 'node' || element.center) {
          const airportLat = element.lat ?? element.center?.lat;
          const airportLon = element.lon ?? element.center?.lon;
          const airportId = element.id;

          if (airportLat !== undefined && airportLon !== undefined) {
            const name = element.tags?.['name'] || 'Unknown Airport';
            const code = element.tags?.['iata'] || ''; // airport IATA code
            // store metadata
            this.airportData.set(airportId, { name, code });

            foundAirportIds.add(airportId);

            // Determine radius: use runway lengths if available, fallback to IATA presence
            const defaultKm = code
              ? MAJOR_AIRPORT_RADIUS_KM
              : MINOR_AIRPORT_RADIUS_KM;
            const useKm = this.airportRadiusCache.get(airportId) ?? defaultKm; // Check if circle already exists
            if (!this.airportCircles.has(airportId)) {
              // Determine initial color based on clicked state
              const isClicked = this.clickedAirports.has(airportId);
              const circleColor = isClicked ? 'gold' : 'cyan';
              const fillPattern = isClicked
                ? 'url(#airportStripedPatternGold)'
                : 'url(#airportStripedPatternCyan)';

              const circle = L.circle([airportLat, airportLon], {
                radius: useKm * 1000,
                color: circleColor,
                weight: 2,
                fill: true,
                fillColor: fillPattern,
                fillOpacity: 0.3,
                className: 'airport-radius',
                interactive: true,
              }).addTo(this.map);
              // Add click event handler to toggle color
              circle.on('click', () => {
                const currentlyClicked = this.clickedAirports.has(airportId);
                if (currentlyClicked) {
                  // Remove from clicked set and change to cyan
                  this.clickedAirports.delete(airportId);
                  circle.setStyle({
                    color: 'cyan',
                    fillColor: 'url(#airportStripedPatternCyan)',
                  });
                } else {
                  // Add to clicked set and change to gold
                  this.clickedAirports.add(airportId);
                  circle.setStyle({
                    color: 'gold',
                    fillColor: 'url(#airportStripedPatternGold)',
                  });
                }
                // Save clicked airports to settings
                this.settings.setClickedAirports(this.clickedAirports);
              });

              // Always bind tooltip; use `permanent` to show/hide labels
              circle.bindTooltip(name, {
                direction: 'center',
                className: 'airport-tooltip',
                opacity: 0.8,
                offset: [0, 0],
                permanent: this.showAirportLabels,
              });
              this.airportCircles.set(airportId, circle); // Use default radius until bulk runway query updates it
              if (!this.airportRadiusCache.has(airportId)) {
                const defaultKm = code
                  ? MAJOR_AIRPORT_RADIUS_KM
                  : MINOR_AIRPORT_RADIUS_KM;
                this.airportRadiusCache.set(airportId, defaultKm);
              }
            } else {
              // Update existing circle color based on clicked state
              const existingCircle = this.airportCircles.get(airportId);
              if (existingCircle) {
                const isClicked = this.clickedAirports.has(airportId);
                const circleColor = isClicked ? 'gold' : 'cyan';
                const fillPattern = isClicked
                  ? 'url(#airportStripedPatternGold)'
                  : 'url(#airportStripedPatternCyan)';
                existingCircle.setStyle({
                  color: circleColor,
                  fillColor: fillPattern,
                });
              }
            }
          }
        }
      } // Remove circles for airports no longer in the result set
      this.airportCircles.forEach((circle, id) => {
        if (!foundAirportIds.has(id)) {
          circle.remove();
          this.airportCircles.delete(id);
          // Remove stored airport metadata
          this.airportData.delete(id);
          // Remove from clicked airports set
          this.clickedAirports.delete(id);
        }
      });

      // Save clicked airports to settings if any were removed
      this.settings.setClickedAirports(this.clickedAirports);

      // --- Bulk fetch runway data for all airports at once ---

      if (this.airportCircles.size > 0) {
        const airportList = Array.from(this.airportCircles.entries()).map(
          ([id, circle]) => ({
            id,
            lat: circle.getLatLng().lat,
            lon: circle.getLatLng().lng,
            hasIata: !!this.airportData.get(id)?.code,
          })
        );
        // compute bbox covering all airports plus margin
        const lats = airportList.map((a) => a.lat);
        const lons = airportList.map((a) => a.lon);
        const minLat = Math.min(...lats) - radiusKm / 111;
        const maxLat = Math.max(...lats) + radiusKm / 111;
        const minLon = Math.min(...lons) - radiusKm / 111;
        const maxLon = Math.max(...lons) + radiusKm / 111;

        const runwayQuery = `
         
          [out:json][timeout:25];
          (
            way[\"aeroway\"=\"runway\"](${minLat},${minLon},${maxLat},${maxLon});
            node[\"aeroway\"=\"runway\"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out geom;
        `;
        const runwayPromise = fetch(overpassUrl, {
          method: 'POST',
          body: runwayQuery,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.elements) return;
            const lengthsByAirport = new Map<number, number>();
            data.elements.forEach((elem: any) => {
              const coords = elem.geometry;
              if (!coords || coords.length < 2) return;
              // compute runway length between first and last point
              const start = coords[0];
              const end = coords[coords.length - 1];
              const lenKm = haversineDistance(
                start.lat,
                start.lon,
                end.lat,
                end.lon
              );
              // find nearest airport center
              let bestId = null;
              let bestDist = Infinity;
              airportList.forEach((a) => {
                const d = haversineDistance(
                  a.lat,
                  a.lon,
                  (start.lat + end.lat) / 2,
                  (start.lon + end.lon) / 2
                );
                if (d < bestDist) {
                  bestDist = d;
                  bestId = a.id;
                }
              });
              if (bestId != null) {
                const prev = lengthsByAirport.get(bestId) || 0;
                lengthsByAirport.set(bestId, Math.max(prev, lenKm));
              }
            });

            // apply computed radii
            airportList.forEach((a) => {
              const circle = this.airportCircles.get(a.id);
              const maxLen = lengthsByAirport.get(a.id) || 0;
              const radius =
                maxLen > 0
                  ? maxLen / 2 + 0.5
                  : a.hasIata
                  ? MAJOR_AIRPORT_RADIUS_KM
                  : MINOR_AIRPORT_RADIUS_KM;
              this.airportRadiusCache.set(a.id, radius);
              if (circle) circle.setRadius(radius * 1000);
            });
          })
          .catch(() => {});
        radiusPromises.push(runwayPromise);
      }
      // wait for all runway radius updates before hiding spinner
      await Promise.all(radiusPromises);
      // Increase opacity of all airport circles after resizing
      this.airportCircles.forEach((circle) =>
        circle.setStyle({ fillOpacity: 0.6 })
      );
      // hide loading indicator inside Angular zone
      this.ngZone.run(() => {
        this.loadingAirports = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      // Failed to fetch or process airport data error would be logged here
      // Hide loading indicator on error
      this.ngZone.run(() => {
        this.loadingAirports = false;
        this.cdr.detectChanges();
      });
    } finally {
      this.airportsLoading = false;
    }
  }

  /**
   * Fetch runway ways around an airport and compute radius as half the longest runway (in km) plus 0.5km buffer.
   */
  private async computeAirportRadiusKm(
    lat: number,
    lon: number,
    hasIata: boolean
  ): Promise<number> {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
      [out:json][timeout:25];
      way["aeroway"="runway"](around:10000,${lat},${lon});
      out geom;
    `;
    try {
      const res = await fetch(overpassUrl, { method: 'POST', body: query });
      if (!res.ok)
        return hasIata ? MAJOR_AIRPORT_RADIUS_KM : MINOR_AIRPORT_RADIUS_KM;
      const data = await res.json();
      let maxLen = 0;
      for (const w of data.elements || []) {
        const coords = w.geometry as Array<{ lat: number; lon: number }>;
        if (coords.length < 2) continue;
        // approximate runway length by first-to-last node
        const start = coords[0];
        const end = coords[coords.length - 1];
        const distKm = haversineDistance(
          start.lat,
          start.lon,
          end.lat,
          end.lon
        );
        maxLen = Math.max(maxLen, distKm);
      }
      if (maxLen > 0) {
        return maxLen / 2 + 0.5; // half runway plus buffer
      }
    } catch {
      // fallback silently
    }
    return hasIata ? MAJOR_AIRPORT_RADIUS_KM : MINOR_AIRPORT_RADIUS_KM;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Show loading indicator and inform Angular to update view
    this.isResizing = true;
    this.cdr.detectChanges();
    // Debounce end of resizing
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      this.isResizing = false;
      this.cdr.detectChanges();
    }, 500);
  }
  /** Temporarily highlight marker and tooltip on overlay hover */
  onHoverOverlayPlane(plane: PlaneLogEntry): void {
    const pm = this.planeLog.get(plane.icao);
    // Only apply hover effect if not the persistently highlighted plane
    if (pm?.marker && plane.icao !== this.highlightedPlaneIcao) {
      pm.marker.setZIndexOffset(5000);
      pm.marker.openTooltip();
      pm.marker
        .getTooltip()
        ?.getElement()
        ?.classList.add('highlighted-tooltip'); // Use correct class
    }
  }

  /** Remove temporary highlight on overlay hover out */
  onUnhoverOverlayPlane(plane: PlaneLogEntry): void {
    const pm = this.planeLog.get(plane.icao);
    // Only remove hover effect if not the persistently highlighted plane
    if (pm?.marker && plane.icao !== this.highlightedPlaneIcao) {
      pm.marker.setZIndexOffset(0);
      // Don't close tooltip if it was opened by persistent highlight
      if (!pm.marker.isTooltipOpen()) {
        pm.marker.closeTooltip();
      }
      pm.marker
        .getTooltip()
        ?.getElement()
        ?.classList.remove('highlighted-tooltip'); // Use correct class
    }
  }

  onUpdateNow(): void {
    this.scanService.forceScan();
  }

  /** Update location information for the followed plane */
  private updatePlaneLocationInfo(): void {
    // Only fetch location when a plane is being followed

    if (this.followNearest && this.highlightedPlaneIcao && this.closestPlane) {
      const plane = this.closestPlane;
      if (plane && plane.lat !== null && plane.lon !== null) {
        this.reverseGeocode(plane.lat, plane.lon).then((address) => {
          if (!address || address.trim() === '') {
            console.log('Empty geocoding result for plane update:', address);
          }
          this.locationStreet = address;
          this.locationDistrict = address;
          if (!this.locationDistrict || this.locationDistrict.trim() === '') {
            console.log(
              'locationDistrict is empty after setting (plane update):',
              this.locationDistrict
            );
          }
          this.cdr.detectChanges();
        });
      }
    }
  }

  onToggleDateTimeOverlays(): void {
    this.showDateTime = !this.showDateTime;

    this.settings.setShowDateTimeOverlay(this.showDateTime);
    this.cdr.detectChanges();
  }

  private updateSunAngle(): void {
    const now = new Date();
    const center = this.map.getCenter();
    const sunPos = SunCalc.getPosition(now, center.lat, center.lng);
    const moonIllum = SunCalc.getMoonIllumination(now);
    const moonPos = SunCalc.getMoonPosition(now, center.lat, center.lng);

    // determine if the sun is below the horizon
    this.isNight = sunPos.altitude < 0;
    // compute moon illumination fraction and rotation
    const p = moonIllum.phase;
    this.moonFraction = moonIllum.fraction;
    this.moonIllumAngleDeg = (moonIllum.angle * 180) / Math.PI;
    this.moonIsWaning = p > 0.5;
    this.moonIcon = this.moonIsWaning ? 'dark_mode' : 'light_mode';

    // Convert SunCalc.azimuth (0 = south, positive westwards) to compass bearing from North (0°=N, clockwise)
    const sunAzDeg = (sunPos.azimuth * 180) / Math.PI;
    this.sunAngle = (sunAzDeg + 180 + 360) % 360; // adjust from south-based azimuth and normalize    // Determine next sun event time
    const timesToday = SunCalc.getTimes(now, center.lat, center.lng);
    let eventTime: Date;
    let label: string;
    if (!this.isNight) {
      // Daytime: show sunset
      eventTime = timesToday.sunset;
      label = 'Sunset: ';
    } else {
      // Nighttime: show next sunrise
      const sunriseToday = timesToday.sunrise;
      const sunsetToday = timesToday.sunset;
      if (now > sunsetToday) {
        // after today's sunset, use tomorrow's sunrise
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        eventTime = SunCalc.getTimes(tomorrow, center.lat, center.lng).sunrise;
      } else {
        // before today's sunrise
        eventTime = sunriseToday;
      }
      label = 'Sunrise: ';
    } // Convert SunCalc time to the actual local time for the map location
    const timezone = this.locationContextService.timezone;
    let localEventTime: Date;
    if (timezone) {
      // SunCalc returns time in browser's timezone, convert to location's timezone
      // First, neutralize the browser timezone effect to get UTC
      const browserOffset = eventTime.getTimezoneOffset(); // Browser offset in minutes
      const utcTime = eventTime.getTime() + browserOffset * 60000; // Convert to UTC

      // Then apply the location's actual timezone offset to get local time
      const locationOffsetMs = timezone.utcOffset * 3600000; // Location offset in milliseconds
      localEventTime = new Date(utcTime + locationOffsetMs);
    } else {
      // Fallback: use SunCalc time as-is if timezone data not available
      localEventTime = eventTime;
    }

    // Format as HH:MM using the timezone-adjusted time
    this.sunEventText =
      label +
      localEventTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  private calculateAzimuth(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Returns azimuth in degrees from (lat1, lon1) to (lat2, lon2), 0 = North
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360;
  } /** Simple check if it's daytime based on sun position */
  private isDaytime(): boolean {
    const now = new Date();
    const center = this.map.getCenter();
    const sunPos = SunCalc.getPosition(now, center.lat, center.lng);
    return sunPos.altitude > 0;
  }

  /** Get the color for the moon's lit part - white during daytime, yellowish during night */
  public getMoonLitColor(): string {
    return this.isDaytime() ? '#ffffff' : '#f4e4a6';
  }

  /** Get the color for the moon's background - white during daytime, light blue during night */
  public getMoonBackgroundColor(): string {
    return this.isDaytime()
      ? 'rgba(255, 255, 255, 0.6)'
      : 'rgba(135, 206, 250, 0.6)';
  }

  public get observerLat() {
    return this.settings.lat ?? this.DEFAULT_COORDS[0];
  }
  public get observerLon() {
    return this.settings.lon ?? this.DEFAULT_COORDS[1];
  }
}
