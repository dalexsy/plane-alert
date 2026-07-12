import type { ChangeDetectorRef } from '@angular/core';
import type { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import type { MapRuntimeService } from './map-runtime.service';
import type { SettingsService } from '../settings/settings.service';
import type { MapInitializerService } from '../map-initializer/map-initializer.service';
import type { UiStateService } from '../ui-state/ui-state.service';
import type { MapPlaneOperationsService } from './map-plane-operations.service';
import type { LocationContextService } from '../location-context/location-context.service';
import { addressLooksWrongForCoordinates } from './map-address-sync.util';

export function syncBootstrapLocationAddress(deps: {
  settings: SettingsService;
  planeOps: MapPlaneOperationsService;
  locationContext: LocationContextService;
  startLat: number;
  startLon: number;
}): void {
  const { settings, planeOps, locationContext, startLat, startLon } = deps;
  const savedAddress = settings.currentAddress;
  const needsResync =
    savedAddress &&
    settings.lat !== null &&
    settings.lon !== null &&
    addressLooksWrongForCoordinates(savedAddress, startLat, startLon);

  if (needsResync) {
    planeOps.reverseGeocode(startLat, startLon).then((address) => {
      locationContext.setLocation(startLat, startLon, address, 'default');
      settings.setLocationWithAddress(startLat, startLon, address);
    });
  } else if (savedAddress) {
    locationContext.setLocation(startLat, startLon, savedAddress, 'default');
  } else {
    planeOps.reverseGeocode(startLat, startLon).then((address) => {
      locationContext.setLocation(startLat, startLon, address, 'default');
      settings.setLocationWithAddress(startLat, startLon, address);
    });
  }
}

export function finalizeBootstrapMarkers(deps: {
  runtime: MapRuntimeService;
  settings: SettingsService;
  mapInitializerService: MapInitializerService;
  uiState: UiStateService;
  lat: number;
  lon: number;
  startLat: number;
  startLon: number;
}): void {
  const {
    runtime,
    settings,
    mapInitializerService,
    uiState,
    lat,
    lon,
    startLat,
    startLon,
  } = deps;

  runtime.homeMarker = mapInitializerService.initializeHomeMarker(
    settings.getHomeLocation()
  );
  mapInitializerService.updateMarkersVisibility(
    lat,
    lon,
    settings.getHomeLocation(),
    runtime.currentLocationMarker,
    runtime.homeMarker
  );

  const homeLocation = settings.getHomeLocation();
  if (
    homeLocation &&
    Math.abs(startLat - homeLocation.lat) < 0.0001 &&
    Math.abs(startLon - homeLocation.lon) < 0.0001
  ) {
    uiState.setConeVisibility(true);
    setTimeout(() => {
      const coneCheckbox = document.getElementById('showCone') as HTMLInputElement;
      if (coneCheckbox) coneCheckbox.checked = true;
    }, 100);
  }
}

export function wireSpecialListMarkerClasses(deps: {
  runtime: MapRuntimeService;
  specialListService: { isSpecial(icao: string): boolean; specialListUpdated$: unknown };
}): void {
  const { runtime, specialListService } = deps;
  (specialListService.specialListUpdated$ as { subscribe(fn: () => void): void }).subscribe(
    () => {
      runtime.planeLog.forEach((plane) => {
        const tooltipEl = plane.marker?.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.classList.toggle(
            'special-plane-tooltip',
            specialListService.isSpecial(plane.icao)
          );
        }
        const markerEl = plane.marker?.getElement();
        if (markerEl) {
          markerEl.classList.toggle(
            'special-plane',
            specialListService.isSpecial(plane.icao)
          );
        }
      });
    }
  );
}

export function prepareBootstrapRuntimeState(deps: {
  runtime: MapRuntimeService;
  resultsSeenPlaneLog: unknown[];
}): void {
  const { runtime, resultsSeenPlaneLog } = deps;
  runtime.planeHistoricalLog = [];
  resultsSeenPlaneLog.length = 0;
  runtime.planeLog.forEach((plane) => {
    plane.positionHistory = [];
    if (plane.historyTrailSegments) plane.historyTrailSegments = [];
  });
}

export function applyBootstrapInputOverlayState(deps: {
  inputOverlayComponent: InputOverlayComponent | null | undefined;
  uiState: UiStateService;
  settings: SettingsService;
  planeDisplayService: {
    applyAnimationSetting(enabled: boolean, document: Document): void;
    setAltitudeBordersEnabled(enabled: boolean): void;
  };
  document: Document;
}): void {
  const { inputOverlayComponent, uiState, settings, planeDisplayService, document } = deps;
  if (inputOverlayComponent) {
    inputOverlayComponent.showDateTime = uiState.showDateTime;
    inputOverlayComponent.showCloudCover = settings.showCloudCover;
    inputOverlayComponent.showRainCover = settings.showRainCover;
    inputOverlayComponent.showViewAxes = settings.showViewAxes;
    inputOverlayComponent.showAirportLabels = settings.showAirportLabels;
  }
  planeDisplayService.applyAnimationSetting(uiState.animationsEnabled, document);
  planeDisplayService.setAltitudeBordersEnabled(uiState.showAltitudeBorders);
}
