import { ChangeDetectorRef } from '@angular/core';
import { ViewConeConfig } from '../settings/settings.service';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import type { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { MapUiControlsService } from './map-ui-controls.service';
import { MapWeatherUiService } from './map-weather-ui.service';
import { MapHomeNavigationService } from './map-home-navigation.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapFollowHandlersService } from './map-follow-handlers.service';
import { AddressResolutionService } from '../address-resolution/address-resolution.service';
import { PlaneFilteringService } from '../plane-filtering/plane-filtering.service';
import type { MapRuntimeService } from './map-runtime.service';

export function createMapComponentDelegates(deps: {
  runtime: MapRuntimeService;
  uiControls: MapUiControlsService;
  weatherUi: MapWeatherUiService;
  homeNav: MapHomeNavigationService;
  planeOps: MapPlaneOperationsService;
  followHandlers: MapFollowHandlersService;
  addressResolution: AddressResolutionService;
  planeFiltering: PlaneFilteringService;
}) {
  const updateMap = (
    input: InputOverlayComponent,
    lat: number,
    lon: number,
    radiusKm?: number,
    zoomLevel?: number
  ) => deps.planeOps.updateMap(input, lat, lon, radiusKm, zoomLevel);

  return {
    onZoomIn(): void {
      deps.uiControls.onZoomIn();
    },
    onZoomOut(): void {
      deps.uiControls.onZoomOut();
    },
    onToggleAirportLabels(): void {
      deps.uiControls.onToggleAirportLabels();
    },
    setCurrentAsHome(): void {
      deps.homeNav.setCurrentAsHome();
    },
    goToHome(input: InputOverlayComponent): void {
      deps.homeNav.goToHome(input);
    },
    useCurrentLocation(input: InputOverlayComponent): void {
      deps.homeNav.useCurrentLocation(input);
    },
    updateMap,
    getWindFromDirection(deg: number): string {
      return deps.uiControls.getWindFromDirection(deg);
    },
    getCurrentWindSpeed(): number {
      return deps.uiControls.getCurrentWindSpeed();
    },
    getCurrentWindUnit(): string {
      return deps.uiControls.getCurrentWindUnit();
    },
    cycleWindUnit(): void {
      deps.uiControls.cycleWindUnit();
    },
    resolveAndUpdateFromAddress(input: InputOverlayComponent): void {
      if (!deps.runtime.map) return;
      deps.addressResolution.resolveAndUpdateFromAddress(
        input,
        (lat, lon, radius, zoom) => updateMap(input, lat, lon, radius, zoom),
        deps.runtime.map.getZoom()
      );
    },
    onExcludeDiscountChange(): void {
      deps.planeFiltering.onExcludeDiscountChange(
        deps.runtime.planeLog,
        deps.runtime.planeHistoricalLog,
        deps.runtime.map
      );
    },
    toggleConeVisibility(show: boolean, cdr: ChangeDetectorRef): void {
      deps.weatherUi.toggleConeVisibility(show, cdr);
    },
    onConeConfigChange(cones: ViewConeConfig[], cdr: ChangeDetectorRef): void {
      deps.weatherUi.onConeConfigChange(cones, cdr);
    },
    onConeConfig(): void {
      deps.weatherUi.onConeConfig();
    },
    toggleCloudCover(show: boolean): void {
      deps.weatherUi.toggleCloudCover(show);
    },
    toggleRainCover(show: boolean): void {
      deps.weatherUi.toggleRainCover(show);
    },
    followNearestPlane(plane: PlaneLogEntry, cdr: ChangeDetectorRef): void {
      deps.followHandlers.followNearestPlane(plane, cdr);
    },
    onCenterAirport(coords: { lat: number; lon: number }): void {
      deps.uiControls.onCenterAirport(coords);
    },
    onWindowResize(cdr: ChangeDetectorRef): void {
      deps.uiControls.onWindowResize(cdr);
    },
    onHoverOverlayPlane(plane: PlaneLogEntry): void {
      deps.followHandlers.onHoverOverlayPlane(plane);
    },
    onUnhoverOverlayPlane(plane: PlaneLogEntry): void {
      deps.followHandlers.onUnhoverOverlayPlane(plane);
    },
    onToggleAltitudeBorders(enabled: boolean, cdr: ChangeDetectorRef): void {
      deps.uiControls.onToggleAltitudeBorders(enabled, cdr);
    },
    onToggleAnimations(enabled: boolean, cdr: ChangeDetectorRef): void {
      deps.uiControls.onToggleAnimations(enabled, cdr);
    },
    onToggleGhostPosition(enabled: boolean, cdr: ChangeDetectorRef): void {
      deps.uiControls.onToggleGhostPosition(enabled, cdr);
    },
    onToggleWindDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
      deps.uiControls.onToggleWindDirection(enabled, cdr);
    },
    onToggleSunDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
      deps.uiControls.onToggleSunDirection(enabled, cdr);
    },
    onToggleDateTimeOverlays(): void {
      deps.uiControls.onToggleDateTimeOverlays();
    },
    onWindowViewToggle(show: boolean): void {
      deps.uiControls.onWindowViewToggle(show);
    },
    toggleBrightness(): void {
      deps.uiControls.toggleBrightness();
    },
  };
}

export type MapComponentDelegateMethods = ReturnType<
  typeof createMapComponentDelegates
>;
