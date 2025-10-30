// src/app/map/map.component.ts

/**
 * ⚠️  WARNING: COMPONENT SIZE LIMIT EXCEEDED ⚠️
 *
 * This component has grown excessively large (>2000 lines) and violates single responsibility principle.
 * It handles too many concerns: map management, plane tracking, weather overlays, UI state,
 * location services, astronomical calculations, and more.
 *
 * 🚫 DO NOT ADD ANY MORE FUNCTIONALITY TO THIS COMPONENT 🚫
 *
 * Instead, create separate services or components for new features:
 * - Services: For business logic, data management, API calls
 * - Components: For UI concerns, overlays, specialized displays
 * - Extract existing functionality into dedicated services when refactoring
 *
 * Recent cleanup removed ~100 lines of context menu code that should have been
 * in a separate component/service. Don't repeat this mistake.
 *
 * Refactoring priority: Break this into smaller, focused components and services.
 */

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
import { ConeComponent } from '../components/cone/cone.component';
import { ConeConfigEditorComponent } from '../components/cone-config-editor/cone-config-editor.component';
import { InputOverlayComponent } from '../components/input-overlay/input-overlay.component';
import {
  ResultsOverlayComponent,
  PlaneLogEntry,
} from '../components/results-overlay/results-overlay.component';
import { CountryService } from '../services/country.service';
import { MapInitializerService } from '../services/map-initializer.service';
import { AirportService } from '../services/airport.service';
import { PlaneDisplayService } from '../services/plane-display.service';
import { PlaneFilterService } from '../services/plane-filter.service';
import { AircraftDbService } from '../services/aircraft-db.service';
import { SettingsService, ViewConeConfig } from '../services/settings.service';
import { ScanService } from '../services/scan.service';
import { PlaneModel } from '../models/plane-model';
import { SpecialListService } from '../services/special-list.service';
import { MapPanService } from '../services/map-pan.service';
import { MapService } from '../services/map.service';
import { DOCUMENT } from '@angular/common';
import { ClockComponent } from '../components/ui/clock.component';
import { TemperatureComponent } from '../components/ui/temperature.component';
import { ClosestPlaneOverlayComponent } from '../components/closest-plane-overlay/closest-plane-overlay.component';
import { LocationOverlayComponent } from '../components/location-overlay/location-overlay.component';
import { WindowViewOverlayComponent } from '../components/window-view-overlay/window-view-overlay.component';
import { AngleOverlayComponent } from '../components/angle-overlay/angle-overlay.component';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import { SkyColorSyncService } from '../services/sky-color-sync.service';
import { GeocodingCacheService } from '../services/geocoding-cache.service';
import { LocationContextService } from '../services/location-context.service';
import { PlaneFollowService } from '../services/plane-follow.service';
import { FollowCoordinatorService } from '../services/follow-coordinator.service';
import { SkyOverlayService } from '../services/sky-overlay.service';
import { MapThemeService } from '../services/map-theme.service';
import { BrightnessService } from '../services/brightness.service';
import { PlaneLogService } from '../services/plane-log.service';
import { FollowService } from '../services/follow.service';
import { ClosestPlaneService } from '../services/closest-plane.service';
import { WeatherLayerService } from '../services/weather-layer.service';
import { FilterManagementService } from '../services/filter-management.service';
import { AddressResolutionService } from '../services/address-resolution.service';
import { UiStateService } from '../services/ui-state.service';
import { AstronomicalDisplayService } from '../services/astronomical-display.service';
import { BrightnessDisplayService } from '../services/brightness-display.service';
import { MapUpdateService } from '../services/map-update.service';
import { PlaneUpdateService } from '../services/plane-update.service';
import { PlaneCenteringService } from '../services/plane-centering.service';
import { PlaneFilteringService } from '../services/plane-filtering.service';
import { EnvironmentalDataService } from '../services/environmental-data.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    ConeComponent,
    ConeConfigEditorComponent,
    InputOverlayComponent,
    ResultsOverlayComponent,
    ClockComponent,
    TemperatureComponent,
    ClosestPlaneOverlayComponent,
    LocationOverlayComponent,
    WindowViewOverlayComponent,
    AngleOverlayComponent,
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
  @ViewChild(WindowViewOverlayComponent, { static: true })
  windowViewOverlayComponent!: WindowViewOverlayComponent;

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
  private locationErrorShown = false;

  // UI overlay toggles - now managed by UiStateService
  get showDateTime() {
    return this.uiState.showDateTime;
  }
  get showAirportLabels() {
    return this.uiState.showAirportLabels;
  }
  get showAltitudeBorders() {
    return this.uiState.showAltitudeBorders;
  }
  get showWindDirection() {
    return this.uiState.showWindDirection;
  }
  get showSunDirection() {
    return this.uiState.showSunDirection;
  }
  get animationsEnabled() {
    return this.uiState.animationsEnabled;
  }
  get showWindowView() {
    return this.uiState.showWindowView;
  }

  // Weather layer toggles - now managed by UiStateService
  get coneVisible() {
    return this.uiState.coneVisible;
  }
  get cloudVisible() {
    return this.uiState.cloudVisible;
  }
  get rainVisible() {
    return this.uiState.rainVisible;
  }

  // Opacity settings for weather layers
  cloudOpacity: number = 1;
  rainOpacity: number = 0.8;

  // Plane logs for results overlay binding
  skyPlaneLog: PlaneLogEntry[] = [];
  airportPlaneLog: PlaneLogEntry[] = [];
  seenPlaneLog: PlaneLogEntry[] = [];

  // Planes for window-view overlay
  windowViewPlanes: WindowViewPlane[] = [];

  // Store found airports and their circles
  airportCircles = new Map<number, L.Circle>(); // Key: Overpass element ID
  private svgPatternRetryTimeout: any = null;
  clickedAirports = new Set<number>();

  // Flag to distinguish programmatic map moves from user-initiated moves
  private isProgrammaticMove = false;
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

  // Cone configuration editor visibility
  showConeConfigEditor = false;

  // View cones configuration (stored as property for change detection)
  viewConesConfig: ViewConeConfig[] = [];

  // New properties for closest-plane overlay
  closestPlane: PlaneModel | null = null;
  closestDistance: number | null = null;
  closestOperator: string | null = null;
  closestSecondsAway: number | null = null;
  closestVelocity: number | null = null;
  /** Whether user is following the nearest overlay plane */
  followNearest = false;

  private isProcessingFollowRequest = false; // guard against recursive follow calls
  currentTime: string = '';

  // Alias for template binding
  get loadingAirports(): boolean {
    return this.airportService.isLoading();
  }

  // New properties for location-overlay component
  locationStreet: string | null = null;
  locationDistrict: string | null = null;

  // Sun angle for solar position overlay - now managed by AstronomicalDisplayService
  get sunAngle() {
    return this.astronomicalDisplay.sunAngle;
  }
  get isNight() {
    return this.astronomicalDisplay.isNight;
  }
  get sunEventText() {
    return this.astronomicalDisplay.sunEventText;
  }
  get moonFraction() {
    return this.astronomicalDisplay.moonFraction;
  }
  get moonIsWaning() {
    return this.astronomicalDisplay.moonIsWaning;
  }
  get moonPhaseName() {
    return this.astronomicalDisplay.moonPhaseName;
  }
  get moonTerminatorAngle() {
    return this.astronomicalDisplay.moonTerminatorAngle;
  }
  get moonIcon() {
    return this.astronomicalDisplay.moonIcon;
  }
  get moonIllumAngleDeg() {
    return this.astronomicalDisplay.moonIllumAngleDeg;
  }

  // Brightness state - now managed by BrightnessDisplayService
  get brightness() {
    return this.brightnessDisplay.brightness;
  }
  get brightnessState() {
    return this.brightnessDisplay.brightnessState;
  }
  private globalTooltipClickHandler!: (e: MouseEvent) => void;
  // Wind direction for wind indicator overlay
  public windAngle: number = 0; // Latest wind speed in m/s
  public windSpeed: number = 0;
  public windStat: number = 0; // intensity level 0-3
  // Wind unit cycling
  public windUnits: string[] = ['m/s', 'knots', 'km/h', 'mph'];
  public currentWindUnitIndex: number = 0;
  constructor(
    @Inject(DOCUMENT) private document: Document,
    public countryService: CountryService,
    private mapService: MapService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private settings: SettingsService,
    private scanService: ScanService,
    private specialListService: SpecialListService,
    private mapPanService: MapPanService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private skyColorSyncService: SkyColorSyncService,
    private locationContext: LocationContextService,
    private geocodingCache: GeocodingCacheService,
    private planeFollowService: PlaneFollowService,
    private followCoordinatorService: FollowCoordinatorService,
    private skyOverlayService: SkyOverlayService,
    private mapThemeService: MapThemeService,
    private brightnessService: BrightnessService,
    private mapInitializerService: MapInitializerService,
    private airportService: AirportService,
    private planeDisplayService: PlaneDisplayService,
    private planeLogService: PlaneLogService,
    private followService: FollowService,
    private closestPlaneService: ClosestPlaneService,
    private weatherLayerService: WeatherLayerService,
    private filterManagementService: FilterManagementService,
    private addressResolution: AddressResolutionService,
    private uiState: UiStateService,
    private astronomicalDisplay: AstronomicalDisplayService,
    private brightnessDisplay: BrightnessDisplayService,
    private planeUpdate: PlaneUpdateService,
    private mapUpdate: MapUpdateService,
    private planeCentering: PlaneCenteringService,
    private planeFiltering: PlaneFilteringService,
    private environmentalData: EnvironmentalDataService
  ) {
    // Initialize view cones configuration from settings
    this.viewConesConfig = this.settings.viewConesConfig;

    // Initialize UI toggles from stored settings - now handled by UiStateService
    // this.cloudVisible = this.settings.showCloudCover;
    // this.rainVisible = this.settings.showRainCover;
    // this.coneVisible = this.settings.showViewAxes;
    // this.showDateTime = this.settings.getDateTimeOverlayVisibility();
    // this.showAirportLabels = this.settings.showAirportLabels;
    // this.showAltitudeBorders = this.settings.showAltitudeBorders;
    // this.showWindDirection = this.settings.showWindDirection;
    // this.showSunDirection = this.settings.showSunDirection;
    // this.animationsEnabled = this.settings.animationsEnabled;
    // this.currentWindUnitIndex = this.settings.windUnitIndex;
    // this.showWindowView = this.settings.showWindowView;

    // Initialize brightness service with current location if available
    const currentLocation = { lat: this.settings.lat, lon: this.settings.lon };
    if (currentLocation.lat !== null && currentLocation.lon !== null) {
      this.brightnessService.setLocation(
        currentLocation.lat,
        currentLocation.lon
      );
    }

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
    }); // Listen for tooltip follow/unfollow events
    window.addEventListener('plane-tooltip-follow', (e: Event) => {
      const icao = (e as CustomEvent).detail?.icao;
      if (!icao) return;
      this.ngZone.run(() => {
        if (this.highlightedPlaneIcao === icao) {
          // Unfollow currently followed plane
          this.followCoordinatorService.clearAllModes();
        } else {
          // Follow new plane manually - this will disable automatic modes
          const pm = this.planeLog.get(icao);
          if (pm) {
            // Use coordinator service for proper mode management
            this.followCoordinatorService.followPlaneManually(pm as any);

            // Center map on followed plane with smooth panning
            if (pm.lat != null && pm.lon != null) {
              this.map.panTo([pm.lat, pm.lon], {
                animate: true,
                duration: 1.0,
              });
              // Update location overlay info but NOT the address input field
              // The address field should show map center location, not plane location
              this.reverseGeocode(pm.lat, pm.lon).then((address) => {
                // Don't set the address input field when following a plane
                // this.inputOverlayComponent.addressInputRef.setValue(address);
                this.locationDistrict = address;
                this.cdr.detectChanges();
              });
            }
          }
        }
      });
    }); // Add global click handler for tooltip follow
    window.addEventListener('click', this.globalTooltipClickHandler);

    // Listen for plane marker right-click events
    // Removed - right-click now handled by plane list items
  }

  /** Handle right-click on plane marker to add to database */
  // Removed - right-click now handled by plane list items
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
    this.uiState.toggleAirportLabels();
    // Update existing airport tooltips to reflect the new permanent state
    this.airportService.updateAirportLabels(this.uiState.showAirportLabels);
  }

  async ngAfterViewInit(): Promise<void> {
    this.settings.load();
    // Load aircraft database
    await this.aircraftDb.load();
    // showDateTime is now managed by UiStateService

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

    // Apply initial animation setting
    this.planeDisplayService.applyAnimationSetting(
      this.animationsEnabled,
      this.document
    );

    // Initialize altitude borders state
    this.planeDisplayService.setAltitudeBordersEnabled(
      this.uiState.showAltitudeBorders
    );

    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;

    // If no current location is set but home location exists, start at home
    const homeLoc = this.settings.getHomeLocation();
    let startLat = lat;
    let startLon = lon;
    if (this.settings.lat === null && this.settings.lon === null && homeLoc) {
      startLat = homeLoc.lat;
      startLon = homeLoc.lon;
    }

    const storedExclude = localStorage.getItem('excludeDiscount');
    if (storedExclude !== null) {
      this.settings.excludeDiscount = storedExclude === 'true';
    }

    // Initialize map and overlays
    this.isProgrammaticMove = true; // Prevent moveend from updating location context during initialization
    const { map, currentLocationMarker } =
      this.mapInitializerService.initializeMap(
        'map',
        startLat,
        startLon,
        radius,
        (dblLat, dblLng) => {
          // Use the current main radius for the update
          const currentMainRadius = this.settings.radius ?? 5;

          // Set location immediately with placeholder address so forceScan uses the new coordinates
          const placeholderAddress = `${dblLat.toFixed(4)}, ${dblLng.toFixed(
            4
          )}`;
          this.settings.setLocationWithAddress(
            dblLat,
            dblLng,
            placeholderAddress
          );

          this.updateMap(dblLat, dblLng, currentMainRadius); // This will trigger airport search

          // Reverse geocode and update with real address
          this.reverseGeocode(dblLat, dblLng).then((address) => {
            this.locationContext.setLocation(
              dblLat,
              dblLng,
              address,
              'address'
            );
            this.settings.setLocationWithAddress(dblLat, dblLng, address);
          });

          this.scanService.forceScan(); // Restart the scan with new location
        }
      );
    this.map = map;
    this.currentLocationMarker = currentLocationMarker;

    // Add moveend listener to update location context when user pans the map
    this.map.on('moveend', () => {
      if (!this.isProgrammaticMove) {
        // Location context is now updated from address changes, not map center changes
        // this.locationContext.updateFromMapCenter(center.lat, center.lng);
      }
      this.isProgrammaticMove = false; // Reset flag
    });

    // Subscribe to location context changes to update map when address is geocoded
    this.locationContext.currentLocation$.subscribe((locationData) => {
      if (
        locationData.source === 'address' &&
        locationData.lat !== undefined &&
        locationData.lon !== undefined
      ) {
        const radius = this.settings.radius ?? 5;
        this.updateMap(locationData.lat, locationData.lon, radius);
      }
    });

    // Initialize services with the map
    this.airportService.initialize(this.map);
    this.airportService.setClickedAirports(this.clickedAirports);
    
    // Initialize weather layers
    this.weatherLayerService.initializeLayers(this.map);
    
    // Apply map layer visibility based on saved preferences
    this.weatherLayerService.toggleCloudCover(
      this.map,
      this.settings.showCloudCover
    );
    this.weatherLayerService.toggleRainCover(
      this.map,
      this.settings.showRainCover
    );
    this.toggleConeVisibility(this.uiState.coneVisible);
    // Apply airport labels visibility - now handled by UiStateService
    // Provide the created map instance to the service
    this.mapService.setMapInstance(this.map);
    // Main radius will be drawn by updateMap to avoid duplicate initial draw
    // Force Angular to detect view changes so radius and cone components render
    this.cdr.detectChanges();
    // Initial map update to draw radius, airports, and planes
    this.updateMap(startLat, startLon, radius);
    // updateMap is called within initMap now via findAndDisplayAirports
    // this.updateMap(lat, lon, radius); // REMOVED - initMap handles initial load

    // Clear geocoding cache to ensure fresh results after unifying geocoding services
    this.geocodingCache.clearCache();

    // Initialize location context with saved address or geocode the starting location
    // Location context is the SINGLE source of truth for current address
    const savedAddress = this.settings.currentAddress;

    // CRITICAL: Check if saved address and coordinates make sense together
    // If address and coordinates are out of sync (e.g., "New York" with Berlin coords),
    // trust the coordinates and re-geocode
    const needsResync =
      savedAddress &&
      this.settings.lat !== null &&
      this.settings.lon !== null &&
      this.addressLooksWrongForCoordinates(savedAddress, startLat, startLon);

    if (needsResync) {
      console.warn('Address and coordinates are out of sync! Re-geocoding...');
      console.warn(
        'Saved address:',
        savedAddress,
        'Coordinates:',
        startLat,
        startLon
      );
      // Clear the bad address and re-geocode
      this.reverseGeocode(startLat, startLon).then((address) => {
        console.log('Re-geocoded to fix mismatch:', address);
        this.locationContext.setLocation(
          startLat,
          startLon,
          address,
          'default'
        );
        this.settings.setLocationWithAddress(startLat, startLon, address);
      });
    } else if (savedAddress) {
      this.locationContext.setLocation(
        startLat,
        startLon,
        savedAddress,
        'default'
      );
    } else {
      // Only reverse-geocode if we don't have a saved address
      this.reverseGeocode(startLat, startLon).then((address) => {
        this.locationContext.setLocation(
          startLat,
          startLon,
          address,
          'default'
        );
        // Save it for next session
        this.settings.setLocationWithAddress(startLat, startLon, address);
      });
    }

    // Initialize home marker if home location exists
    this.homeMarker = this.mapInitializerService.initializeHomeMarker(
      this.settings.getHomeLocation()
    );

    // Update markers visibility based on current location
    this.mapInitializerService.updateMarkersVisibility(
      lat,
      lon,
      this.settings.getHomeLocation(),
      this.currentLocationMarker,
      this.homeMarker
    );

    // Check if we're at home location and enable cones if we are
    const homeLocation = this.settings.getHomeLocation();
    if (
      homeLocation &&
      Math.abs(startLat - homeLocation.lat) < 0.0001 &&
      Math.abs(startLon - homeLocation.lon) < 0.0001
    ) {
      // We're starting at the home position, enable cones
      this.uiState.setConeVisibility(true);

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

    // Initialize plane log service with component references
    this.planeLogService.initialize(
      this.resultsOverlayComponent,
      this.windowViewOverlayComponent
    );
    this.planeLogService.setMapComponent(this);

    // Start astronomical updates (sun/moon/sunrise/sunset calculations)
    this.astronomicalDisplay.startAstronomicalUpdates();

    // Initialize map update service
    this.mapUpdate.setInitialScanDone(false);

    // Subscribe to commercial filter changes
    this.settings.excludeDiscountChanged.subscribe(() => {
      // Re-filter planes when commercial toggle changes
      this.filterManagementService.onExcludeDiscountChange(
        this.planeLog,
        this.planeHistoricalLog,
        this.map
      );
    });
    this.resultsOverlayComponent.clearHistoricalList.subscribe(() =>
      this.filterManagementService.clearSeenList(
        this.planeHistoricalLog,
        this.resultsOverlayComponent,
        this.cdr
      )
    );
    this.resultsOverlayComponent.exportFilterList.subscribe(() =>
      this.filterManagementService.exportFilterList()
    );

    // Subscribe to follow service state changes
    this.planeFollowService.followState$.subscribe((followState) => {
      this.handleFollowStateChange(followState);
    });

    // Subscribe to follow service for follow requests
    this.planeFollowService.follow$.subscribe((followRequest) => {
      this.handleFollowRequest(followRequest);
    });
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
        this.planeHistoricalLog = this.planeLogService.updatePlaneLog(
          Array.from(this.planeLog.values())
        );
      }
    );
    this.scanService.start(this.settings.interval, () => {
      this.findPlanes();
    });
    // Force an initial scan on startup
    this.scanService.forceScan();

    // Subscribe to radius changes: clear markers and paths outside new radius
    this.settings.radiusChanged.subscribe((newRadius) => {
      // Get current center coordinates
      const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
      const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];

      // Redraw the main radius circle without re-centering
      this.mapService.setMainRadius(lat, lon, newRadius);

      // Remove planes outside new radius and update airports
      this.removeOutOfRangePlanes(lat, lon, newRadius);
      this.airportService.findAndDisplayAirports(
        lat,
        lon,
        newRadius,
        this.showAirportLabels
      );
    });

    // Initialize map panning service
    this.mapPanService.init(this.map); // Initialize sun angle overlay and kick off periodic updates
    // Astronomical updates are now handled by AstronomicalDisplayService    // Subscribe to sky color changes for cloud layer synchronization
    this.skyColorSyncService.skyColors$.subscribe((skyColors) => {
      if (skyColors && this.cloudLayer) {
        this.applySkyColorsToCloudLayer(skyColors);
      }
    });

    // Subscribe to brightness changes from BrightnessService
    // this.brightnessService.brightness$.subscribe((brightnessState) => {
    //   this.ngZone.run(() => {
    //     this.brightnessState = brightnessState;
    //     this.brightness = brightnessState.brightness;
    //     this.applyBrightnessToMap();
    //     this.cdr.detectChanges();
    //   });
    // });

    // Initialize brightness service with current location
    this.brightnessService.setLocation(startLat, startLon);

    // Initialize environmental data service and subscribe to wind data
    this.environmentalData.setLocation(startLat, startLon);
    this.environmentalData.windData$.subscribe((windData) => {
      if (windData) {
        this.windSpeed = windData.speed;
        this.windAngle = windData.direction;
        this.windStat = windData.stat;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.scanService.stop();
    this.mapPanService.destroy();
    // Clean up airport circles
    this.airportService.destroy();
    if (this.svgPatternRetryTimeout) {
      clearTimeout(this.svgPatternRetryTimeout);
    }
    // Astronomical interval cleanup is handled by AstronomicalDisplayService
    // Brightness service cleanup is handled by BrightnessDisplayService
    // Clean up sky overlay service
    this.skyOverlayService.destroy();
    // Clean up map theme service
    this.mapThemeService.destroy();
    window.removeEventListener('click', this.globalTooltipClickHandler);
  }

  /**
   * Check if a saved address looks wrong for the given coordinates
   * This detects out-of-sync issues like "New York" with Berlin coordinates
   */
  private addressLooksWrongForCoordinates(
    address: string,
    lat: number,
    lon: number
  ): boolean {
    // Simple heuristic: check if address mentions a place that's clearly wrong
    const addressLower = address.toLowerCase();

    // European coordinates (roughly 35-70N, -10 to 40E)
    const isEurope = lat > 35 && lat < 70 && lon > -10 && lon < 40;
    // North American coordinates (roughly 25-50N, -125 to -65W)
    const isNorthAmerica = lat > 25 && lat < 50 && lon > -125 && lon < -65;

    // Check for obvious mismatches
    if (
      isEurope &&
      (addressLower.includes('new york') ||
        addressLower.includes('united states') ||
        addressLower.includes('canada') ||
        addressLower.includes('mexico'))
    ) {
      return true;
    }
    if (
      isNorthAmerica &&
      (addressLower.includes('berlin') ||
        addressLower.includes('germany') ||
        addressLower.includes('france') ||
        addressLower.includes('italy'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Handle follow state changes from PlaneFollowService
   */
  private handleFollowStateChange(followState: any): void {
    // Update internal follow state based on service state
    if (followState.mode === 'none') {
      this.followNearest = false;
      this.highlightedPlaneIcao = null;
    } else if (followState.followedPlaneIcao) {
      this.highlightedPlaneIcao = followState.followedPlaneIcao;

      // Set followNearest based on mode type
      this.followNearest = followState.mode !== 'manual';
    }

    // Update visual indicators
    this.followService.updateFollowedStyles(
      this.planeLog,
      this.highlightedPlaneIcao
    );
    this.cdr.detectChanges();
  }

  /**
   * Handle follow requests from PlaneFollowService
   */ private handleFollowRequest(followRequest: any): void {
    // Prevent infinite recursion
    if (this.isProcessingFollowRequest) {
      return;
    }

    this.isProcessingFollowRequest = true;

    try {
      const { plane, fromShuffle = false, fromNearest = false } = followRequest;

      if (!plane) return;

      // Convert to consistent format for centerOnPlane
      const planeLogEntry = {
        icao: plane.icao,
        lat: plane.lat,
        lon: plane.lon,
        ...plane,
      };

      // Call existing centerOnPlane method with appropriate flags
      this.centerOnPlane(
        planeLogEntry,
        fromShuffle || fromNearest,
        fromShuffle
      );
    } finally {
      this.isProcessingFollowRequest = false;
    }
  }

  // Set a marker for the home location
  private setHomeMarker(lat: number, lon: number): void {
    // Remove previous home marker if it exists
    if (this.homeMarker) {
      this.homeMarker.remove();
    }

    this.homeMarker = this.mapInitializerService.initializeHomeMarker({
      lat,
      lon,
    });
  }

  // Set current location as home
  setCurrentAsHome(): void {
    const lat = this.settings.lat;
    const lon = this.settings.lon;

    if (lat !== null && lon !== null) {
      // Get the current address from the location context (single source of truth)
      const currentAddress = this.locationContext.currentLocation.address;

      // Save home location to settings with the address
      this.settings.setHomeLocation(lat, lon, currentAddress || undefined);

      // Set home marker on map
      this.setHomeMarker(lat, lon);
    }
  }

  // Go to home location
  goToHome(): void {
    const homeLocation = this.settings.getHomeLocation();

    if (homeLocation) {
      // Show the cone when going home
      this.uiState.setConeVisibility(true);

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

      // Determine the address to use
      let addressToUse = homeLocation.address;

      // If home location doesn't have an address, try to get it from current location context
      if (!addressToUse) {
        const currentLoc = this.locationContext.currentLocation;
        // If we're already at home coordinates, use the current address
        if (
          currentLoc.lat === homeLocation.lat &&
          currentLoc.lon === homeLocation.lon
        ) {
          addressToUse = currentLoc.address;
        }
      }

      if (addressToUse) {
        this.locationContext.setLocation(
          homeLocation.lat,
          homeLocation.lon,
          addressToUse,
          'home'
        );
        // Save coordinates AND address together atomically
        this.settings.setLocationWithAddress(
          homeLocation.lat,
          homeLocation.lon,
          addressToUse
        );
      } else {
        // As last resort, reverse geocode
        this.locationContext.updateFromMapCenter(
          homeLocation.lat,
          homeLocation.lon,
          'home'
        );
        this.reverseGeocode(homeLocation.lat, homeLocation.lon).then(
          (address) => {
            this.settings.setLocationWithAddress(
              homeLocation.lat,
              homeLocation.lon,
              address
            );
            // Also update home location to include address
            this.settings.setHomeLocation(
              homeLocation.lat,
              homeLocation.lon,
              address
            );
          }
        );
      }
    }
  }

  /** Central update function */
  async updateMap(
    lat: number,
    lon: number,
    radiusKm?: number, // This is the MAIN search radius
    zoomLevel?: number
  ): Promise<void> {
    this.isProgrammaticMove = true;
    await this.mapUpdate.updateMap(
      this.map,
      this.currentLocationMarker,
      this.homeMarker,
      this.inputOverlayComponent,
      this.planeLog,
      this.planeHistoricalLog,
      lat,
      lon,
      radiusKm,
      zoomLevel
    );
    // Location context is now updated from address changes, not map center changes
    // this.locationContext.updateFromMapCenter(lat, lon);
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
    // Save the wind unit preference
    this.settings.setWindUnitIndex(this.currentWindUnitIndex);
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
    this.planeHistoricalLog = this.planeLogService.updatePlaneLog(
      Array.from(this.planeLog.values())
    );
  }
  reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }
  findPlanes(): void {
    // Update last scan time in input overlay
    if (this.inputOverlayComponent) {
      this.inputOverlayComponent.lastScanTime = new Date();
    }

    this.planeUpdate
      .findPlanes(
        this.map,
        this.planeLog,
        this.planeHistoricalLog,
        this.planeNewTimestamps,
        this.activePlaneIcaos,
        this.highlightedPlaneIcao,
        this.followNearest,
        this.cdr
      )
      .then(({ faviconUrl }) => {
        // Update favicon if it changed
        if (faviconUrl) {
          this.updateFavicon(faviconUrl);
        }

        // Update component properties with the results
        this.closestPlaneService.computeClosestPlane(
          this.planeLog as Map<string, PlaneModel>,
          this.highlightedPlaneIcao
        );
        const closestData = this.closestPlaneService.getClosestPlaneData();
        this.closestPlane = closestData.closestPlane;
        this.closestDistance = closestData.closestDistance;
        this.closestOperator = closestData.closestOperator;
        this.closestSecondsAway = closestData.closestSecondsAway;
        this.closestVelocity = closestData.closestVelocity;
        this.locationStreet = closestData.locationStreet;
        this.locationDistrict = closestData.locationDistrict;

        this.manualUpdate = false;
      })
      .catch(() => {
        // Error in findPlanes would be logged here
      });
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
    this.uiState.setConeVisibility(false);

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
          // Update location context with current source (this will reverse-geocode)
          this.locationContext.updateFromMapCenter(
            position.coords.latitude,
            position.coords.longitude,
            'current'
          );

          // Save coordinates AND address together atomically for persistence
          this.reverseGeocode(
            position.coords.latitude,
            position.coords.longitude
          ).then((address) => {
            this.settings.setLocationWithAddress(
              position.coords.latitude,
              position.coords.longitude,
              address
            );
          });
        },
        () => {
          if (!this.locationErrorShown) {
            // Fallback to default coordinates
            // Use current main radius for fallback update
            const currentMainRadius = this.settings.radius ?? 5;
            this.updateMap(
              this.DEFAULT_COORDS[0],
              this.DEFAULT_COORDS[1],
              currentMainRadius // Pass main radius
            ); // Triggers airport search
            this.inputOverlayComponent.addressInputRef.setValue(
              'Unable to fetch location; using default'
            );
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
    this.addressResolution.resolveAndUpdateFromAddress(
      this.inputOverlayComponent,
      this.updateMap.bind(this),
      this.map.getZoom()
    );
  }

  onExcludeDiscountChange(): void {
    this.planeFiltering.onExcludeDiscountChange(
      this.planeLog,
      this.planeHistoricalLog,
      this.map
    );
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
    this.uiState.setConeVisibility(show);
    this.settings.setShowViewAxes(show);
    // Trigger change detection to update the template
    this.cdr.detectChanges();
  }

  onConeConfigChange(cones: ViewConeConfig[]): void {
    this.settings.setViewConesConfig(cones);
    // Update local property to trigger change detection
    this.viewConesConfig = [...cones];
    // Trigger change detection to update the cone display
    this.cdr.detectChanges();
  }

  onConeConfig(): void {
    // Toggle cone config editor visibility
    this.showConeConfigEditor = !this.showConeConfigEditor;
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
    this.uiState.setCloudVisible(show);
    // Actually toggle the layer on the map
    if (this.map) {
      this.weatherLayerService.toggleCloudCover(this.map, show);
    }
  }

  /** Toggle display of rain coverage layer */
  toggleRainCover(show: boolean): void {
    this.uiState.setRainVisible(show);
    // Actually toggle the layer on the map
    if (this.map) {
      this.weatherLayerService.toggleRainCover(this.map, show);
    }
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
    this.planeCentering.centerOnPlane(
      plane,
      preserveFollowNearest,
      fromShuffle,
      {
        highlightedPlaneIcao: this.highlightedPlaneIcao,
        followNearest: this.followNearest,
        planeLog: this.planeLog,
        map: this.map,
        reverseGeocode: this.reverseGeocode.bind(this),
        locationDistrict: this.locationDistrict,
        closestPlane: this.closestPlane,
        planeHistoricalLog: this.planeHistoricalLog,
        setHighlightedPlaneIcao: (icao) => (this.highlightedPlaneIcao = icao),
        setFollowNearest: (value) => (this.followNearest = value),
        setClosestPlane: (plane) => (this.closestPlane = plane),
        setLocationDistrict: (district) => (this.locationDistrict = district),
        setPlaneHistoricalLog: (log: PlaneModel[]) =>
          (this.planeHistoricalLog = log),
        unhighlightPlane: this.unhighlightPlane.bind(this),
      }
    );
  }
  /** Follow and center on overlay-selected nearest plane */
  public followNearestPlane(plane: any): void {
    // If this is a marker (not a real plane), do nothing
    if (plane.isMarker) {
      return;
    }
    const isFromShuffle = !!plane.followMe;

    // Route through coordinator service for proper mode management
    if (isFromShuffle) {
      // This is from shuffle mode, already managed by coordinator
      this.followNearest = true;
      // We need to call centerOnPlane with preserveFollowNearest=false so that
      // it doesn't skip updating the followNearest flag inside centerOnPlane
      this.centerOnPlane(plane, false, true); // pass fromShuffle=true
    } else {
      // Manual selection - route through coordinator for proper follow management
      this.followCoordinatorService.followPlaneManually(plane);
    }
  }
  /** Handle centering map on selected airport coordinates */
  public onCenterAirport(coords: { lat: number; lon: number }): void {
    // Pan map to airport coordinates with smooth animation
    this.map.panTo([coords.lat, coords.lon], { animate: true, duration: 1.0 });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Show loading indicator and inform Angular to update view
    this.isResizing = true;
    this.cdr.detectChanges();
    // Update clock visibility based on new screen size
    this.uiState.setShowDateTime(this.settings.getDateTimeOverlayVisibility());
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

  onToggleDateTimeOverlays(): void {
    this.uiState.toggleDateTimeOverlay();
  }

  /** Toggle altitude-colored borders on plane tooltips */
  onToggleAltitudeBorders(enabled: boolean): void {
    this.uiState.setShowAltitudeBorders(enabled);

    // Update all existing tooltips with the new border style
    this.planeDisplayService.updateTooltipAltitudeBorders(
      Array.from(this.planeLog.values()),
      enabled
    );

    this.cdr.detectChanges();
  }

  /** Toggle animations on/off */
  onToggleAnimations(enabled: boolean): void {
    this.uiState.setAnimationsEnabled(enabled);

    // Apply animation setting to document body for CSS animation control
    this.planeDisplayService.applyAnimationSetting(enabled, this.document);

    this.cdr.detectChanges();
  }

  /** Toggle wind direction display on/off */
  onToggleWindDirection(enabled: boolean): void {
    this.uiState.setShowWindDirection(enabled);

    this.cdr.detectChanges();
  }

  /** Toggle sun direction display on/off */
  onToggleSunDirection(enabled: boolean): void {
    this.uiState.setShowSunDirection(enabled);

    this.cdr.detectChanges();
  }

  /** Get the background color for the moon (dark side) */
  public getMoonBackgroundColor(): string {
    // Return dark color for the moon's shadow
    return '#000000';
  }

  /** Get the lit color for the moon (illuminated side) */
  public getMoonLitColor(): string {
    // Return light color for the moon's illuminated side
    return '#d4d4d4';
  }

  /** Observer latitude (current map center latitude) */
  public get observerLat(): number {
    return this.currentLat;
  }

  /** Observer longitude (current map center longitude) */
  public get observerLon(): number {
    return this.currentLon;
  }

  /** Toggle window view overlay visibility */
  onWindowViewToggle(show: boolean) {
    this.uiState.setShowWindowView(show);
  }

  /** Toggle map brightness between normal and dimmed */
  public toggleBrightness(): void {
    this.brightnessDisplay.toggleBrightness();
  }
}
