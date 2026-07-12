import { Injectable, Inject, ChangeDetectorRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapBootstrapSubscriptionsService } from './map-bootstrap-subscriptions.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapWeatherUiService } from './map-weather-ui.service';
import { AircraftDbService } from '../aircraft-db/aircraft-db.service';
import { SettingsService } from '../settings/settings.service';
import { SpecialListService } from '../special-list/special-list.service';
import { LocationContextService } from '../location-context/location-context.service';
import { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import { MapInitializerService } from '../map-initializer/map-initializer.service';
import { AirportService } from '../airport/airport.service';
import { WeatherOverlayService } from '../weather-overlay/weather-overlay.service';
import { MapService } from './map.service';
import { PlaneDisplayService } from '../plane-display/plane-display.service';
import { PlaneLogService } from '../plane-log/plane-log.service';
import { AstronomicalDisplayService } from '../astronomical-display/astronomical-display.service';
import { MapUpdateService } from '../map-update/map-update.service';
import { UiStateService } from '../ui-state/ui-state.service';
import { ScanService } from '../scan/scan.service';
import { isKioskMode } from '../../utils/kiosk-mode/kiosk-mode.util';
import { initializeMapForBootstrap } from './map-bootstrap-init.util';
import {
  applyBootstrapInputOverlayState,
  finalizeBootstrapMarkers,
  prepareBootstrapRuntimeState,
  syncBootstrapLocationAddress,
  wireSpecialListMarkerClasses,
} from './map-bootstrap-post-init.util';

export interface MapHostRefs {
  inputOverlayComponent: InputOverlayComponent;
  resultsOverlayComponent: ResultsOverlayComponent;
  windowViewOverlayComponent?: WindowViewOverlayComponent;
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
    if (isKioskMode()) {
      this.document.body.classList.add('kiosk-mode');
    }
    const aircraftDbReady = this.aircraftDb.load();
    this.overlay.clickedAirports = this.settings.getClickedAirports();

    prepareBootstrapRuntimeState({
      runtime: this.runtime,
      resultsSeenPlaneLog: resultsOverlayComponent.seenPlaneLog,
    });
    wireSpecialListMarkerClasses({
      runtime: this.runtime,
      specialListService: this.specialListService,
    });
    window.addEventListener('click', this.runtime.globalTooltipClickHandler);
    applyBootstrapInputOverlayState({
      inputOverlayComponent,
      uiState: this.uiState,
      settings: this.settings,
      planeDisplayService: this.planeDisplayService,
      document: this.document,
    });

    const { startLat, startLon, lat, lon } = await initializeMapForBootstrap({
      runtime: this.runtime,
      settings: this.settings,
      mapInitializerService: this.mapInitializerService,
      planeOps: this.planeOps,
      locationContext: this.locationContext,
      scanService: this.scanService,
      airportService: this.airportService,
      weatherOverlayService: this.weatherOverlayService,
      mapService: this.mapService,
      weatherUi: this.weatherUi,
      geocodingCache: this.geocodingCache,
      overlay: this.overlay,
      uiState: this.uiState,
      inputOverlayComponent,
      cdr,
    });

    syncBootstrapLocationAddress({
      settings: this.settings,
      planeOps: this.planeOps,
      locationContext: this.locationContext,
      startLat,
      startLon,
    });
    finalizeBootstrapMarkers({
      runtime: this.runtime,
      settings: this.settings,
      mapInitializerService: this.mapInitializerService,
      uiState: this.uiState,
      lat,
      lon,
      startLat,
      startLon,
    });

    this.planeLogService.initialize(resultsOverlayComponent, windowViewOverlayComponent);
    this.planeLogService.setOverlayState(this.overlay);
    this.astronomicalDisplay.startAstronomicalUpdates();
    this.mapUpdate.setInitialScanDone(false);
    this.subscriptions.wire(refs, startLat, startLon);
    void aircraftDbReady.then(() => this.scanService.forceScan());
  }

  teardown(): void {
    if (this.runtime.svgPatternRetryTimeout) {
      clearTimeout(this.runtime.svgPatternRetryTimeout);
    }
    window.removeEventListener('click', this.runtime.globalTooltipClickHandler);
  }
}
