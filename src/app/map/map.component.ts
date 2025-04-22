// src/app/map/map.component.ts
import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ViewEncapsulation,
  HostListener,
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
import { Plane } from '../types/plane';
import { PlaneModel } from '../models/plane-model';
import { ensureStripedPattern } from '../utils/svg-utils';
import { SpecialListService } from '../services/special-list.service';
import { MapPanService } from '../services/map-pan.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    RadiusComponent,
    ConeComponent,
    InputOverlayComponent,
    ResultsOverlayComponent,
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None, // Restored for Leaflet map elements
})
export class MapComponent implements AfterViewInit, OnDestroy {
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
  airportCircle!: L.Circle;
  homeMarker: L.Marker | null = null;

  airportCoords: [number, number] = this.DEFAULT_COORDS;
  airportRadiusKm = 3;
  manualUpdate = false;
  private toggling = false;
  private locationErrorShown = false;

  coneVisible = false; // Default to hidden

  constructor(
    public countryService: CountryService,
    private planeFinder: PlaneFinderService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private settings: SettingsService,
    private scanService: ScanService,
    private specialListService: SpecialListService,
    private mapPanService: MapPanService,
    private cdr: ChangeDetectorRef
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

  async ngAfterViewInit(): Promise<void> {
    await this.countryService.init();
    await this.aircraftDb.load();
    this.settings.load();

    const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;

    const storedExclude = localStorage.getItem('excludeDiscount');
    if (storedExclude !== null) {
      this.settings.excludeDiscount = storedExclude === 'true';
    }

    this.initMap(lat, lon, radius);
    this.updateMap(lat, lon, radius);

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
        console.log(
          '[MapComponent] filterPrefix event received for:',
          plane.icao,
          'Current filteredOut:',
          plane.filteredOut
        );
        const prefix = this.planeFilter.extractAirlinePrefix(plane.callsign);
        console.log('[MapComponent] Extracted prefix:', prefix);
        // Use togglePrefix instead of addPrefix
        this.planeFilter.togglePrefix(prefix);

        // Find the actual PlaneModel instance in the main log
        const planeModel = this.planeLog.get(plane.icao);
        if (planeModel) {
          console.log(
            '[MapComponent] Found PlaneModel:',
            planeModel.icao,
            'Before filter update, filteredOut:',
            planeModel.filteredOut
          );
          // Re-evaluate filter status based on the updated filter list
          const isMilitary =
            this.aircraftDb.lookup(planeModel.icao)?.mil || false;
          const shouldBeFiltered = !this.planeFilter.shouldIncludeCallsign(
            planeModel.callsign,
            this.settings.excludeDiscount,
            this.planeFilter.getFilterPrefixes(),
            isMilitary
          );
          console.log(
            '[MapComponent] Should this plane be filtered now?',
            shouldBeFiltered
          );

          if (planeModel.filteredOut !== shouldBeFiltered) {
            planeModel.filteredOut = shouldBeFiltered;
            console.log(
              '[MapComponent] Updated planeModel.filteredOut to:',
              planeModel.filteredOut
            );
            // We only update the flag, visuals are handled by CSS now
            // planeModel.removeVisuals(this.map); // DO NOT REMOVE VISUALS
          } else {
            console.log(
              '[MapComponent] planeModel.filteredOut status already correct.'
            );
          }
        } else {
          console.warn(
            '[MapComponent] Could not find PlaneModel in planeLog for icao:',
            plane.icao
          );
        }

        // Trigger an update of the logs passed to the results overlay
        this.updatePlaneLog(Array.from(this.planeLog.values()));
        this.cdr.detectChanges(); // Ensure change detection runs
      }
    );

    this.scanService.start(this.settings.interval, () => this.findPlanes());
    this.scanService.forceScan();

    // Subscribe to radius changes: clear markers and paths outside new radius
    this.settings.radiusChanged.subscribe((newRadius) => {
      const lat = this.settings.lat ?? this.DEFAULT_COORDS[0];
      const lon = this.settings.lon ?? this.DEFAULT_COORDS[1];
      this.removeOutOfRangePlanes(lat, lon, newRadius);
    });

    // Initialize map panning service
    this.mapPanService.init(this.map);
  }

  ngOnDestroy(): void {
    this.scanService.stop();
    this.mapPanService.destroy();
  }

  private initMap(lat: number, lon: number, radius: number): void {
    this.map = L.map('map', { doubleClickZoom: false }).setView([lat, lon], 12); // Disable double-click zoom

    // Create a custom pane for hovered items with a high z-index
    this.map.createPane('hoverPane');
    const hoverPane = this.map.getPane('hoverPane');
    if (hoverPane) {
      hoverPane.style.zIndex = '9999'; // Higher than default panes (popupPane is often 700)
    }

    // Create a custom pane for path arrowheads below overlayPane
    this.map.createPane('pathArrowheadPane');
    const pathArrowheadPane = this.map.getPane('pathArrowheadPane');
    if (pathArrowheadPane) {
      pathArrowheadPane.style.zIndex = '410'; // Above overlayPane (400)
    }

    // Create a custom pane for the main radius circle, below tiles
    this.map.createPane('radiusPane');
    const radiusPane = this.map.getPane('radiusPane');
    if (radiusPane) {
      radiusPane.style.zIndex = '250'; // Above tilePane (200) but below overlayPane (400)
    }

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

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
    // Add the airport radius (foreground)
    this.airportCircle = L.circle(this.airportCoords, {
      pane: 'overlayPane',
      radius: this.airportRadiusKm * 1000,
      color: 'cyan',
      weight: 2,
      fill: true,
      fillColor: 'url(#airportStripedPattern)',
      fillOpacity: 0.8,
      className: 'airport-radius', // Add a unique class for airport radius
      interactive: false, // Not clickable
    }).addTo(this.map);

    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    ensureStripedPattern(svg, 'airportStripedPattern', 'cyan', 0.5);
    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    this.map.on('dblclick', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      this.settings.setLat(lat); // Persist the new latitude
      this.settings.setLon(lng); // Persist the new longitude

      // Update marker position and ensure it's added to the map
      this.currentLocationMarker.setLatLng([lat, lng]);

      // Make sure marker is visible on the map
      if (!this.map.hasLayer(this.currentLocationMarker)) {
        this.currentLocationMarker.addTo(this.map);
      }

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

  updateMap(
    lat: number,
    lon: number,
    radiusKm?: number,
    zoomLevel?: number
  ): void {
    console.log('[MapComponent] updateMap called with:', {
      lat,
      lon,
      radiusKm,
      zoomLevel,
    });
    // Clamp radius to a maximum of 500km
    let radius = radiusKm ?? this.settings.radius ?? 5;
    if (radius > 500) {
      radius = 500;
    }
    this.settings.setLat(lat);
    this.settings.setLon(lon);
    this.settings.setRadius(radius);
    this.manualUpdate = true;
    this.map.setView([lat, lon], zoomLevel ?? 12); // Use provided zoom level if available

    // Update current marker position (but keep it removed if at home)
    this.currentLocationMarker.setLatLng([lat, lon]);

    // Update markers visibility based on new location
    this.updateMarkersVisibility(lat, lon);

    this.reverseGeocode(lat, lon).then((address) => {
      this.inputOverlayComponent.addressInputRef.nativeElement.value = address;
    });
    this.inputOverlayComponent.searchRadiusInputRef.nativeElement.value =
      radius.toString();

    this.removeOutOfRangePlanes(lat, lon, radius);
    console.log('[MapComponent] Calling scanService.forceScan()');
    this.scanService.forceScan();
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
        this.planeLog.delete(icao);
      }
    }
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

          // Determine filter status first
          const isMilitary = this.aircraftDb.lookup(planeModel.icao)?.mil;
          planeModel.filteredOut = !this.planeFilter.shouldIncludeCallsign(
            planeModel.callsign,
            exclude, // Use the 'exclude' variable from the outer scope
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
              // First, check if this is a military plane and apply the military-plane-tooltip class
              // regardless of other states
              if (isMilitary) {
                // Use the isMilitary variable determined above
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.add('military-plane-tooltip');
              } else {
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.remove('military-plane-tooltip');
              }

              // Then proceed with the other class handling
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
                planeModel.marker
                  .getTooltip()
                  ?.getElement()
                  ?.classList.remove('new-plane-tooltip');
              } else if (planeModel.isNew) {
                planeModel.marker
                  ?.getElement()
                  ?.classList.remove('grounded-plane'); // Ensure grounded removed
                planeModel.marker
                  ?.getTooltip()
                  ?.getElement()
                  ?.classList.remove('grounded-plane-tooltip'); // Ensure grounded tooltip removed

                if (isMilitary) {
                  planeModel.marker
                    .getElement()
                    ?.classList.add('military-plane');
                  planeModel.marker.getElement()?.classList.remove('new-plane');
                  // Tooltip handled above
                  planeModel.marker
                    .getTooltip()
                    ?.getElement()
                    ?.classList.remove('new-plane-tooltip');
                } else {
                  planeModel.marker.getElement()?.classList.add('new-plane');
                  planeModel.marker
                    .getElement()
                    ?.classList.remove('military-plane');
                  planeModel.marker
                    .getTooltip()
                    ?.getElement()
                    ?.classList.add('new-plane-tooltip');
                  // Tooltip handled above (military removed)
                }
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

                // For non-new planes, add military-plane class if it's military
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

        this.updatePlaneLog(updatedPlaneModels);
        this.manualUpdate = false;
        this.cdr.detectChanges();
      });
  }

  updatePlaneLog(planes: PlaneModel[]): void {
    const sortByMilitary = (a: PlaneModel, b: PlaneModel) => {
      const aIsMilitary = this.aircraftDb.lookup(a.icao)?.mil || false;
      const bIsMilitary = this.aircraftDb.lookup(b.icao)?.mil || false;
      if (aIsMilitary !== bIsMilitary) return aIsMilitary ? -1 : 1;
      return b.firstSeen - a.firstSeen || a.icao.localeCompare(b.icao);
    };

    // Use the original 'planes' array here
    const sky = planes.filter(
      (entry) =>
        entry.lat != null &&
        entry.lon != null &&
        haversineDistance(
          this.DEFAULT_COORDS[0],
          this.DEFAULT_COORDS[1],
          entry.lat!,
          entry.lon!
        ) > this.airportRadiusKm
    );
    sky.sort(sortByMilitary);

    // Use the original 'planes' array here
    const airport = planes.filter(
      (entry) =>
        entry.lat != null &&
        entry.lon != null &&
        haversineDistance(
          this.DEFAULT_COORDS[0],
          this.DEFAULT_COORDS[1],
          entry.lat!,
          entry.lon!
        ) <= this.airportRadiusKm
    );
    airport.sort(sortByMilitary);

    // Assign the potentially unfiltered lists to the overlay component
    this.resultsOverlayComponent.skyPlaneLog = sky;
    this.resultsOverlayComponent.airportPlaneLog = airport;

    // Update the historical log (merge and keep all planes, filtering happens in overlay)
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

    // Sort the full historical log
    this.planeHistoricalLog.sort(sortByMilitary);

    // Log isNew status for seen planes being sent to overlay
    const seenLogForOverlay = this.planeHistoricalLog.slice().reverse();

    // Assign the full, sorted historical list to the overlay component
    this.resultsOverlayComponent.seenPlaneLog = seenLogForOverlay;
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
          this.updateMap(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          if (!this.locationErrorShown) {
            // Fallback to default coordinates
            this.updateMap(this.DEFAULT_COORDS[0], this.DEFAULT_COORDS[1]);
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
    // Hide the cone when navigating to airport
    this.coneVisible = false;

    // Update the Show View Axes checkbox to match
    const coneCheckbox = document.getElementById(
      'showCone'
    ) as HTMLInputElement;
    if (coneCheckbox) {
      coneCheckbox.checked = false;
    }

    this.updateMap(this.DEFAULT_COORDS[0], this.DEFAULT_COORDS[1]);
  }

  resolveAndUpdateFromAddress(): void {
    console.log('[MapComponent] resolveAndUpdateFromAddress called');
    const address =
      this.inputOverlayComponent.addressInputRef.nativeElement.value;
    const radius =
      this.inputOverlayComponent.searchRadiusInputRef.nativeElement
        .valueAsNumber;

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

    if (!isNaN(radius)) {
      this.settings.setRadius(radius);
    }
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log('[MapComponent] Geocoding fetch successful:', data);
        if (data.length) {
          const currentZoom = this.map.getZoom(); // Preserve current zoom level
          this.updateMap(
            parseFloat(data[0].lat),
            parseFloat(data[0].lon),
            radius,
            currentZoom
          );
        }
      })
      .catch((error) => {
        console.error('[MapComponent] Geocoding fetch failed:', error);
      });
  }

  onExcludeDiscountChange(): void {
    const exclude = this.settings.excludeDiscount;
    // Don't set the property again to avoid infinite loop
    localStorage.setItem('excludeDiscount', exclude.toString());
    console.log(
      `[${new Date().toISOString()}] [MapComponent] Commercial filter changed to: ${exclude}`
    );

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
    return this.settings.radius ?? 5;
  }

  toggleConeVisibility(show: boolean): void {
    this.coneVisible = show;
  }
}
