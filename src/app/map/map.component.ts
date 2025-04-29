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
import { playAlertSound } from '../utils/alert-sound';
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

// OpenWeatherMap tile service API key - replace with your own key
const OPEN_WEATHER_MAP_API_KEY = '6f2c97ad14d775fd86df2f6e1384b7af';

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

  coneVisible = false; // Default to hidden
  cloudVisible = true; // Show cloud layer by default
  cloudOpacity = 1;

  // Store found airports and their circles
  private airportCircles = new Map<number, L.Circle>(); // Key: Overpass element ID
  private svgPatternRetryTimeout: any = null;
  private mainRadiusCircle?: L.Circle;
  private coneLayers: L.Polygon[] = [];
  // Cache computed radii (km) per airport ID to avoid repeat Overpass calls
  private airportRadiusCache = new Map<number, number>();
  // Store metadata for each airport: name and IATA code
  private airportData = new Map<number, { name: string; code?: string }>();

  // Flag for airport fetching (loading) to show loading indicator
  loadingAirports = false;
  // Flag for viewport resizing (legacy) if needed
  isResizing = false;
  private resizeTimeout: any;

  // Tile layer for cloud coverage overlay
  private cloudLayer?: L.TileLayer;

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
  /** Whether user is following the nearest overlay plane */
  followNearest = false;

  private airportsLoading = false; // guard for Overpass fetches
  currentTime: string = '';

  showDateTime = true;

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
    private militaryPrefixService: MilitaryPrefixService
  ) {
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
  }

  onToggleDateTimeOverlays(): void {
    this.showDateTime = !this.showDateTime;
    this.settings.setShowDateTimeOverlay(this.showDateTime);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.countryService.init();
    await this.aircraftDb.load();
    // Load configured military prefix list for overlay flags
    await this.militaryPrefixService.loadPrefixes();
    this.settings.load();
    // Restore saved show/hide date-time overlay setting
    this.showDateTime = this.settings.showDateTimeOverlay;

    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;

    const storedExclude = localStorage.getItem('excludeDiscount');
    if (storedExclude !== null) {
      this.settings.excludeDiscount = storedExclude === 'true';
    }

    this.initMap(lat, lon, radius); // Pass main radius
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
            this.settings.excludeDiscount, // Use current setting
            this.planeFilter.getFilterPrefixes(),
            isMilitary
          );

          // Update the filteredOut status directly on the model
          planeModel.filteredOut = shouldBeFiltered;

          // --- Handle Visuals ---
          if (shouldBeFiltered) {
            // Remove visuals if the plane is now filtered out
            planeModel.removeVisuals(this.map);
          } else {
            // If it was filtered and now isn't, re-add visuals if they exist but aren't on map
            // Note: This is a simplified re-add. The main findPlanes loop handles full visual creation.
            if (planeModel.marker && !this.map.hasLayer(planeModel.marker)) {
              planeModel.marker.addTo(this.map);
              if (planeModel.path) planeModel.path.addTo(this.map);
              if (planeModel.predictedPathArrowhead)
                planeModel.predictedPathArrowhead.addTo(this.map);
              if (planeModel.historyTrailSegments) {
                planeModel.historyTrailSegments.forEach((segment) =>
                  segment.addTo(this.map)
                );
              }
            }
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

    this.scanService.start(this.settings.interval, () => this.findPlanes());
    // Don't force scan here, updateMap will trigger it after airport search
    // this.scanService.forceScan(); // REMOVED

    // Subscribe to radius changes: clear markers and paths outside new radius
    this.settings.radiusChanged.subscribe((newRadius) => {
      const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
      const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
      this.removeOutOfRangePlanes(lat, lon, newRadius);
      // Also update airports when main radius changes
      this.findAndDisplayAirports(lat, lon, newRadius);
    });

    // Initialize map panning service
    this.mapPanService.init(this.map);
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
  }

  private initMap(lat: number, lon: number, radius: number): void {
    this.map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    }).setView([lat, lon], 12);

    // Disable overlay pointer-events while panning
    this.map.on('movestart', () =>
      this.ngZone.run(() => (this.panning = true))
    );
    this.map.on('moveend', () => this.ngZone.run(() => (this.panning = false)));

    // Add SVG renderer for vector overlays (draws into overlayPane)
    L.svg().addTo(this.map);

    // Define airport striped pattern in overlayPane's SVG
    const overlaySvg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement | null;
    if (overlaySvg) {
      ensureStripedPattern(overlaySvg, 'airportStripedPattern', 'cyan', 0.5);
    }

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    // Cloud coverage overlay from OpenWeatherMap
    this.cloudLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
      {
        className: 'cloud-layer',
        opacity: this.cloudOpacity,
        attribution: 'Weather data © OpenWeatherMap',
      }
    )
      .addTo(this.map)
      .on('tileerror', (error) =>
        console.error('Cloud tile load error:', error)
      );
    // Ensure clouds render above base tiles
    this.cloudLayer.setZIndex(650);

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
    this.updateMarkersVisibility(lat, lon);

    // Remove direct rendering of the main radius here. The RadiusComponent handles the main radius.
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
        this.inputOverlayComponent.addressInputRef.nativeElement.value =
          address;
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

  // Central update function
  updateMap(
    lat: number,
    lon: number,
    radiusKm?: number, // This is the MAIN search radius
    zoomLevel?: number
  ): void {
    const t0 = performance.now();
    console.debug(
      `[MapComponent] updateMap start lat=${lat}, lon=${lon}, radiusKm=${radiusKm}`
    );
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
      if (this.inputOverlayComponent.addressInputRef?.nativeElement) {
        this.reverseGeocode(lat, lon).then((address) => {
          this.inputOverlayComponent.addressInputRef.nativeElement.value =
            address;
        });
      }
      if (this.inputOverlayComponent.searchRadiusInputRef?.nativeElement) {
        this.inputOverlayComponent.searchRadiusInputRef.nativeElement.value =
          mainRadius.toString();
      }
    }

    // Find airports within the new MAIN radius
    this.findAndDisplayAirports(lat, lon, mainRadius).then(() => {
      const t1 = performance.now();
      console.debug(
        `[MapComponent] findAndDisplayAirports completed in ${(t1 - t0).toFixed(
          1
        )}ms`
      );
      // Only after airports are potentially updated, remove out-of-range planes
      // and force a plane scan.
      this.removeOutOfRangePlanes(lat, lon, mainRadius);

      this.scanService.forceScan();
    });
  }

  removeOutOfRangePlanes(lat: number, lon: number, radius: number): void {
    for (const [icao, plane] of this.planeLog.entries()) {
      if (
        plane.lat == null ||
        plane.lon == null ||
        haversineDistance(lat, lon, plane.lat, plane.lon) > radius
      ) {
        plane.marker?.remove();
        plane.path?.remove();
        plane.removeVisuals(this.map); // Use the comprehensive removal method
        this.planeLog.delete(icao);
      }
    }
    // Update the set of active plane ICAOs after removal
    this.activePlaneIcaos = new Set(this.planeLog.keys());
    this.updatePlaneLog(Array.from(this.planeLog.values()));
  }

  reverseGeocode(lat: number, lon: number): Promise<string> {
    return fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    )
      .then((res) => res.json())
      .then(
        (data) => data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`
      );
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
        this.planeLog as Map<string, PlaneModel>
      )
      .then(({ anyNew, currentIDs, updatedLog }) => {
        console.log('[MapComponent] findPlanes returned IDs:', currentIDs);
        console.log(
          '[MapComponent] updatedLog ICAOs:',
          updatedLog.map((p) => p.icao)
        );

        // Dynamically update favicon if special or military plane detected
        const hasSpecial = updatedLog.some((p) =>
          this.specialListService.isSpecial(p.icao)
        );
        const hasMil = updatedLog.some(
          (p) => !!this.aircraftDb.lookup(p.icao)?.mil
        );
        // console.debug(`[Favicon] findPlanes: hasSpecial=${hasSpecial}, hasMil=${hasMil}`);
        const iconToUse = hasSpecial
          ? 'assets/favicon/special/favicon.ico'
          : hasMil
          ? 'assets/favicon/military/favicon.ico'
          : 'assets/favicon/favicon.ico';
        // console.debug('[Favicon] Selected icon to update:', iconToUse);
        this.updateFavicon(iconToUse);

        const newUnfiltered = updatedLog.filter(
          (p) => p.isNew && !p.filteredOut
        );
        // Alert on any new visible plane, but suppress only when hide-commercial filter and commercial mute are both on and all new are commercial
        const newVisible = updatedLog.filter((p) => p.isNew && !p.filteredOut);
        if (newVisible.length > 0) {
          const allCommercial = newVisible.every(
            (p) => !this.aircraftDb.lookup(p.icao)?.mil
          );
          // Only suppress when commercial-mute is on and ALL new visible planes are commercial
          if (!(allCommercial && this.settings.commercialMute)) {
            playAlertSound();
          }
        }

        const existing = new Set(currentIDs);
        for (const [id, plane] of this.planeLog.entries()) {
          if (!existing.has(id)) {
            plane.marker?.remove();
            plane.path?.remove();
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
                } else {
                  planeModel.marker
                    .getElement()
                    ?.classList.remove('military-plane');
                }
                // Tooltips handled above
              }
            }
          }
          // Always update the log regardless of filter status
          this.planeLog.set(planeModel.icao, planeModel);
        }

        // Update the set of active plane ICAOs
        this.activePlaneIcaos = new Set(this.planeLog.keys());

        // Update both the overlay and lists via updatePlaneLog
        this.updatePlaneLog(updatedPlaneModels);
        this.manualUpdate = false;
        // Reapply tooltip highlight after updates if a plane is followed
        if (this.highlightedPlaneIcao) {
          const pm = this.planeLog.get(this.highlightedPlaneIcao);
          const tooltipEl = pm?.marker?.getTooltip()?.getElement();
          tooltipEl?.classList.add('highlighted-tooltip');
        }
        this.cdr.detectChanges();
      });
  }

  /** Compute and update the overlay to show the nearest plane (or tracked) */
  private computeClosestPlane(): void {
    const centerLat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const centerLon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    // Use PlaneModel entries from planeLog
    let candidate: PlaneModel | undefined;
    // If followingNearest, start with highlighted plane if still present
    if (this.followNearest && this.highlightedPlaneIcao) {
      candidate = this.planeLog.get(this.highlightedPlaneIcao) || undefined;
    }
    // Otherwise find the nearest visible plane by distance
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
      return;
    }
    // Update overlay properties
    this.closestPlane = candidate;
    const dist = haversineDistance(
      centerLat,
      centerLon,
      candidate.lat!,
      candidate.lon!
    );
    this.closestDistance = Math.round(dist * 10) / 10;
    this.closestOperator = candidate.operator || null;
    this.closestSecondsAway =
      candidate.velocity != null
        ? Math.round((dist * 1000) / candidate.velocity!)
        : null;
    console.log(
      `[MapComponent] Nearest overlay entry ICAO=${candidate.icao}, callsign=${
        candidate.callsign
      }, distance=${dist.toFixed(2)}km`
    );
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
      console.warn(
        '[Favicon] No <link rel="icon"> or <link rel="shortcut icon"> tags found'
      );
      return;
    }
    links.forEach((link) => {
      link.href = iconUrl;
    });
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
          if (dist <= radiusMeters) {
            const data = this.airportData.get(id);
            if (data) {
              p.airportCode = data.code || undefined;
              p.airportName = data.name;
            }
          }
        }
      });
    });
    const visiblePlanes = planes.filter(
      (p) => !p.filteredOut && p.lat != null && p.lon != null
    );
    visiblePlanes.sort((a, b) => a.firstSeen - b.firstSeen); // Sort by firstSeen ascending
    // Update results list
    this.resultsOverlayComponent.skyPlaneLog = visiblePlanes;
    this.resultsOverlayComponent.airportPlaneLog = [];
    // Update nearest overlay and UI debug in sync
    if (visiblePlanes.length > 0) {
      const top = visiblePlanes[0];
      this.closestPlane = top;
      this.closestDistance =
        Math.round(
          haversineDistance(centerLat, centerLon, top.lat!, top.lon!) * 10
        ) / 10;
      this.closestOperator = top.operator || null;
      this.closestSecondsAway = top.velocity
        ? Math.round(
            (haversineDistance(centerLat, centerLon, top.lat!, top.lon!) *
              1000) /
              top.velocity!
          )
        : null;
      const distStr = this.closestDistance.toFixed(1);
      console.log(
        `[MapComponent] UI top plane ICAO=${top.icao}, callsign=${top.callsign}, distance=${distStr}km`
      );
      console.log(
        `[MapComponent] Nearest overlay entry ICAO=${top.icao}, callsign=${top.callsign}, distance=${distStr}km`
      );
    } else {
      this.closestPlane = null;
      this.closestDistance = null;
      this.closestOperator = null;
      this.closestSecondsAway = null;
    }

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
    // Build seen list: apply commercial filter to hide filtered planes
    const historyFiltered = this.planeHistoricalLog.filter(
      (p) => !p.filteredOut
    );
    // Build seen list: specials first, then military, then others, each by recency
    const specialPlanes = historyFiltered.filter((p) =>
      this.specialListService.isSpecial(p.icao)
    );
    const militaryPlanes = historyFiltered.filter(
      (p) =>
        !this.specialListService.isSpecial(p.icao) &&
        (this.aircraftDb.lookup(p.icao)?.mil || false)
    );
    const otherPlanes = historyFiltered.filter(
      (p) =>
        !this.specialListService.isSpecial(p.icao) &&
        !(this.aircraftDb.lookup(p.icao)?.mil || false)
    );
    // Already sorted by firstSeen descending, so slices preserve order
    this.resultsOverlayComponent.seenPlaneLog = [
      ...specialPlanes,
      ...militaryPlanes,
      ...otherPlanes,
    ];
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

  goToAirport(): void {
    // This now goes to the *default* coordinates, as there's no single "the airport"
    // Hide the cone when navigating to airport
    this.coneVisible = false;

    // Update the Show View Axes checkbox to match
    const coneCheckbox = document.getElementById(
      'showCone'
    ) as HTMLInputElement;
    if (coneCheckbox) {
      coneCheckbox.checked = false;
    }

    // Use current main radius for update
    const currentMainRadius = this.settings.radius ?? 5;
    this.updateMap(
      this.DEFAULT_COORDS[0],
      this.DEFAULT_COORDS[1],
      currentMainRadius // Pass main radius
    ); // Triggers airport search
  }

  resolveAndUpdateFromAddress(): void {
    console.debug(
      `[MapComponent] resolveAndUpdateFromAddress called with address='${this.inputOverlayComponent.addressInputRef.nativeElement.value}'`
    );
    // If following a plane, stop tracking when user sets a new location
    if (this.highlightedPlaneIcao) {
      this.unhighlightPlane(this.highlightedPlaneIcao);
      this.highlightedPlaneIcao = null;
      this.centerZoom = null;
      this.updatePlaneLog(Array.from(this.planeLog.values()));
      this.resultsOverlayComponent.sortLogs();
      this.resultsOverlayComponent.updateFilteredLogs();
      this.cdr.detectChanges();
    }

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
  }

  /** Adjust cloud layer opacity */
  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    if (this.cloudLayer) {
      this.cloudLayer.setOpacity(opacity);
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
  centerOnPlane(plane: PlaneLogEntry, preserveFollowNearest = false): void {
    if (!preserveFollowNearest) {
      this.followNearest = false;
    }
    const icao = plane.icao;
    // If already highlighted, remove highlight
    if (this.highlightedPlaneIcao === icao) {
      this.unhighlightPlane(icao);
      this.highlightedPlaneIcao = null;
      this.centerZoom = null;
      // Refresh lists to reflect removal of highlight
      this.updatePlaneLog(Array.from(this.planeLog.values()));
      // Force overlay to sort and re-filter
      this.resultsOverlayComponent.sortLogs();
      this.resultsOverlayComponent.updateFilteredLogs();
      this.cdr.detectChanges();
      return;
    }

    // Unhighlight previously highlighted plane
    if (this.highlightedPlaneIcao) {
      this.unhighlightPlane(this.highlightedPlaneIcao);
    }

    // Highlight new plane
    this.highlightedPlaneIcao = icao; // Set the new highlighted ICAO
    const pm = this.planeLog.get(icao);
    if (pm?.marker && plane.lat != null && plane.lon != null) {
      // Set zoom level one higher and center map on plane
      this.centerZoom = 10;
      this.map.setView([plane.lat, plane.lon], this.centerZoom);
      // Bring marker to front
      pm.marker.setZIndexOffset(10000); // bring marker above others
      // Open tooltip and apply highlight styling
      pm.marker.openTooltip();
      const tooltip = pm.marker.getTooltip();
      if (tooltip) {
        const tooltipEl = tooltip.getElement();
        tooltipEl?.classList.add('highlighted-tooltip'); // Use highlight class
      }
      const markerEl = pm.marker.getElement();
      markerEl?.classList.add('highlighted-marker');
      // Refresh lists so this plane moves to the top
      this.updatePlaneLog(Array.from(this.planeLog.values()));
      this.resultsOverlayComponent.sortLogs();
      this.resultsOverlayComponent.updateFilteredLogs();
      this.cdr.detectChanges();
    }
  }

  /** Follow and center on overlay-selected nearest plane */
  public followNearestPlane(plane: PlaneModel): void {
    this.centerOnPlane(
      {
        callsign: plane.callsign,
        origin: plane.origin,
        firstSeen: plane.firstSeen,
        model: plane.model,
        operator: plane.operator,
        bearing: plane.bearing,
        cardinal: plane.cardinal,
        arrow: plane.arrow,
        icao: plane.icao,
        isNew: plane.isNew,
        lat: plane.lat,
        lon: plane.lon,
        filteredOut: plane.filteredOut,
        isMilitary: plane.isMilitary,
        isSpecial: plane.isSpecial,
      },
      true
    ); // preserve followNearest flag on initial follow
  }

  // New function to find and display airports
  async findAndDisplayAirports(
    lat: number,
    lon: number,
    radiusKm: number
  ): Promise<void> {
    if (this.airportsLoading) {
      console.debug(
        '[MapComponent] findAndDisplayAirports skipped: already loading'
      );
      return;
    }
    this.airportsLoading = true;
    console.debug(
      `[MapComponent] findAndDisplayAirports start lat=${lat}, lon=${lon}, radiusKm=${radiusKm}`
    );
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
            const useKm = this.airportRadiusCache.get(airportId) ?? defaultKm;

            // Check if circle already exists
            if (!this.airportCircles.has(airportId)) {
              const circle = L.circle([airportLat, airportLon], {
                radius: useKm * 1000,
                color: 'cyan',
                weight: 2,
                fill: true,
                fillColor: 'url(#airportStripedPattern)',
                fillOpacity: 0.3, // initial low opacity
                className: 'airport-radius',
                interactive: false,
              }).addTo(this.map);
              this.airportCircles.set(airportId, circle);

              // Use default radius until bulk runway query updates it
              if (!this.airportRadiusCache.has(airportId)) {
                const defaultKm = code
                  ? MAJOR_AIRPORT_RADIUS_KM
                  : MINOR_AIRPORT_RADIUS_KM;
                this.airportRadiusCache.set(airportId, defaultKm);
              }
            }
          }
        }
      }

      // Remove circles for airports no longer in the result set
      this.airportCircles.forEach((circle, id) => {
        if (!foundAirportIds.has(id)) {
          circle.remove();
          this.airportCircles.delete(id);
          // Remove stored airport metadata
          this.airportData.delete(id);
        }
      });

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
      console.error(
        '[MapComponent] Failed to fetch or process airport data:',
        error
      );
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
}
