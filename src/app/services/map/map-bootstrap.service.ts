import { Injectable, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapBootstrapSubscriptionsService } from './map-bootstrap-subscriptions.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapWeatherUiService } from './map-weather-ui.service';
import { addressLooksWrongForCoordinates } from './map-address-sync.util';
import { AircraftDbService } from '../aircraft-db.service';
import { SettingsService } from '../settings.service';
import { SpecialListService } from '../special-list.service';
import { LocationContextService } from '../location-context.service';
import { GeocodingCacheService } from '../geocoding-cache.service';
import { MapInitializerService } from '../map-initializer.service';
import { AirportService } from '../airport.service';
import { WeatherOverlayService } from '../weather-overlay.service';
import { MapService } from '../map.service';
import { PlaneDisplayService } from '../plane-display.service';
import { PlaneLogService } from '../plane-log.service';
import { AstronomicalDisplayService } from '../astronomical-display.service';
import { MapUpdateService } from '../map-update.service';
import { UiStateService } from '../ui-state.service';
import { ScanService } from '../scan.service';

export interface MapHostRefs {
  inputOverlayComponent: InputOverlayComponent;
  resultsOverlayComponent: ResultsOverlayComponent;
  windowViewOverlayComponent: WindowViewOverlayComponent;
  cdr: ChangeDetectorRef;
}

@Injectable({ providedIn: 'root' })
export class MapBootstrapService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private aircraftDb: AircraftDbService,
    private settings: SettingsService,
    private specialListService: SpecialListService,
    private locationContext: LocationContextService,
    private geocodingCache: GeocodingCacheService,
    private mapInitializerService: MapInitializerService,
    private airportService: AirportService,
    private weatherOverlayService: WeatherOverlayService,
    private mapService: MapService,
    private planeDisplayService: PlaneDisplayService,
    private planeLogService: PlaneLogService,
    private astronomicalDisplay: AstronomicalDisplayService,
    private mapUpdate: MapUpdateService,
    private uiState: UiStateService,
    private scanService: ScanService,
    private planeOps: MapPlaneOperationsService,
    private weatherUi: MapWeatherUiService,
    private subscriptions: MapBootstrapSubscriptionsService
  ) {}

  async bootstrap(refs: MapHostRefs): Promise<void> {
    const { inputOverlayComponent, resultsOverlayComponent, windowViewOverlayComponent, cdr } =
      refs;

    this.settings.load();
    await this.aircraftDb.load();
    this.overlay.clickedAirports = this.settings.getClickedAirports();

    this.runtime.planeHistoricalLog = [];
    resultsOverlayComponent.seenPlaneLog = [];
    this.runtime.planeLog.forEach((plane) => {
      plane.positionHistory = [];
      if (plane.historyTrailSegments) plane.historyTrailSegments = [];
    });

    this.specialListService.specialListUpdated$.subscribe(() => {
      this.runtime.planeLog.forEach((plane) => {
        const tooltipEl = plane.marker?.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.classList.toggle(
            'special-plane-tooltip',
            this.specialListService.isSpecial(plane.icao)
          );
        }
        const markerEl = plane.marker?.getElement();
        if (markerEl) {
          markerEl.classList.toggle(
            'special-plane',
            this.specialListService.isSpecial(plane.icao)
          );
        }
      });
    });

    window.addEventListener('click', this.runtime.globalTooltipClickHandler);

    if (inputOverlayComponent) {
      inputOverlayComponent.showDateTime = this.uiState.showDateTime;
      inputOverlayComponent.showCloudCover = this.settings.showCloudCover;
      inputOverlayComponent.showRainCover = this.settings.showRainCover;
      inputOverlayComponent.showViewAxes = this.settings.showViewAxes;
      inputOverlayComponent.showAirportLabels = this.settings.showAirportLabels;
    }

    this.planeDisplayService.applyAnimationSetting(
      this.uiState.animationsEnabled,
      this.document
    );
    this.planeDisplayService.setAltitudeBordersEnabled(
      this.uiState.showAltitudeBorders
    );

    const lat = this.settings.lat ?? this.runtime.DEFAULT_COORDS[0];
    const lon = this.settings.lon ?? this.runtime.DEFAULT_COORDS[1];
    const radius = this.settings.radius ?? 5;

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

    this.runtime.isProgrammaticMove = true;
    const { map, currentLocationMarker } =
      this.mapInitializerService.initializeMap(
        'map',
        startLat,
        startLon,
        radius,
        (dblLat, dblLng) => {
          const currentMainRadius = this.settings.radius ?? 5;
          const placeholderAddress = `${dblLat.toFixed(4)}, ${dblLng.toFixed(4)}`;
          this.settings.setLocationWithAddress(dblLat, dblLng, placeholderAddress);
          this.planeOps.updateMap(inputOverlayComponent, dblLat, dblLng, currentMainRadius);
          this.planeOps.reverseGeocode(dblLat, dblLng).then((address) => {
            this.locationContext.setLocation(dblLat, dblLng, address, 'address');
            this.settings.setLocationWithAddress(dblLat, dblLng, address);
          });
          this.scanService.forceScan();
        }
      );
    this.runtime.map = map;
    this.runtime.currentLocationMarker = currentLocationMarker;

    this.runtime.map.on('moveend', () => {
      this.runtime.isProgrammaticMove = false;
    });

    this.locationContext.currentLocation$.subscribe((locationData) => {
      if (
        locationData.source === 'address' &&
        locationData.lat !== undefined &&
        locationData.lon !== undefined
      ) {
        const r = this.settings.radius ?? 5;
        this.planeOps.updateMap(inputOverlayComponent, locationData.lat, locationData.lon, r);
      }
    });

    this.airportService.initialize(this.runtime.map);
    this.airportService.setClickedAirports(this.overlay.clickedAirports);
    this.weatherOverlayService.setCloudCoverVisible(this.settings.showCloudCover);
    this.weatherOverlayService.setRainCoverVisible(this.settings.showRainCover);
    this.weatherUi.toggleConeVisibility(this.uiState.coneVisible, cdr);
    this.mapService.setMapInstance(this.runtime.map);
    cdr.detectChanges();
    await this.planeOps.updateMap(inputOverlayComponent, startLat, startLon, radius);
    this.geocodingCache.clearCache();

    const savedAddress = this.settings.currentAddress;
    const needsResync =
      savedAddress &&
      this.settings.lat !== null &&
      this.settings.lon !== null &&
      addressLooksWrongForCoordinates(savedAddress, startLat, startLon);

    if (needsResync) {
      this.planeOps.reverseGeocode(startLat, startLon).then((address) => {
        this.locationContext.setLocation(startLat, startLon, address, 'default');
        this.settings.setLocationWithAddress(startLat, startLon, address);
      });
    } else if (savedAddress) {
      this.locationContext.setLocation(startLat, startLon, savedAddress, 'default');
    } else {
      this.planeOps.reverseGeocode(startLat, startLon).then((address) => {
        this.locationContext.setLocation(startLat, startLon, address, 'default');
        this.settings.setLocationWithAddress(startLat, startLon, address);
      });
    }

    this.runtime.homeMarker = this.mapInitializerService.initializeHomeMarker(
      this.settings.getHomeLocation()
    );
    this.mapInitializerService.updateMarkersVisibility(
      lat,
      lon,
      this.settings.getHomeLocation(),
      this.runtime.currentLocationMarker,
      this.runtime.homeMarker
    );

    const homeLocation = this.settings.getHomeLocation();
    if (
      homeLocation &&
      Math.abs(startLat - homeLocation.lat) < 0.0001 &&
      Math.abs(startLon - homeLocation.lon) < 0.0001
    ) {
      this.uiState.setConeVisibility(true);
      setTimeout(() => {
        const coneCheckbox = document.getElementById('showCone') as HTMLInputElement;
        if (coneCheckbox) coneCheckbox.checked = true;
      }, 100);
    }

    this.planeLogService.initialize(resultsOverlayComponent, windowViewOverlayComponent);
    this.planeLogService.setOverlayState(this.overlay);
    this.astronomicalDisplay.startAstronomicalUpdates();
    this.mapUpdate.setInitialScanDone(false);

    await this.subscriptions.wire(refs, startLat, startLon);
  }

  teardown(): void {
    if (this.runtime.svgPatternRetryTimeout) {
      clearTimeout(this.runtime.svgPatternRetryTimeout);
    }
    window.removeEventListener('click', this.runtime.globalTooltipClickHandler);
  }
}
