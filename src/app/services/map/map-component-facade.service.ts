import { Injectable, ChangeDetectorRef } from '@angular/core';
import { ViewConeConfig } from '../settings.service';
import { SettingsService } from '../settings.service';
import { AddressResolutionService } from '../address-resolution.service';
import { PlaneFilteringService } from '../plane-filtering.service';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapUiControlsService } from './map-ui-controls.service';
import { MapWeatherUiService } from './map-weather-ui.service';
import { MapHomeNavigationService } from './map-home-navigation.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapFollowHandlersService } from './map-follow-handlers.service';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import type { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import {
  mapCurrentLat,
  mapCurrentLon,
  mapRadiusKm,
  mapHomeLocationValue,
  mapIsAtHome,
} from './map-location-query.util';

/** Template-facing map actions and location getters (keeps MapComponent under budget). */
@Injectable({ providedIn: 'root' })
export class MapComponentFacadeService {
  constructor(
    public runtime: MapRuntimeService,
    public overlay: MapOverlayStateService,
    private settings: SettingsService,
    private uiControls: MapUiControlsService,
    private weatherUi: MapWeatherUiService,
    private homeNav: MapHomeNavigationService,
    private planeOps: MapPlaneOperationsService,
    private followHandlers: MapFollowHandlersService,
    private addressResolution: AddressResolutionService,
    private planeFiltering: PlaneFilteringService
  ) {}

  get currentLat(): number {
    return mapCurrentLat(this.settings, this.runtime.DEFAULT_COORDS);
  }

  get currentLon(): number {
    return mapCurrentLon(this.settings, this.runtime.DEFAULT_COORDS);
  }

  get radiusKm(): number {
    return mapRadiusKm(this.settings);
  }

  get homeLocationValue(): { lat: number; lon: number } | null {
    return mapHomeLocationValue(this.settings);
  }

  get isAtHome(): boolean {
    return mapIsAtHome(this.settings, this.runtime.DEFAULT_COORDS);
  }

  get observerLat(): number {
    return this.currentLat;
  }

  get observerLon(): number {
    return this.currentLon;
  }

  get windAngle(): number {
    return this.runtime.windAngle;
  }

  get windStat(): number {
    return this.runtime.windStat;
  }

  onZoomIn(): void {
    this.uiControls.onZoomIn();
  }

  onZoomOut(): void {
    this.uiControls.onZoomOut();
  }

  onToggleAirportLabels(): void {
    this.uiControls.onToggleAirportLabels();
  }

  setCurrentAsHome(): void {
    this.homeNav.setCurrentAsHome();
  }

  goToHome(input: InputOverlayComponent): void {
    this.homeNav.goToHome(input);
  }

  useCurrentLocation(input: InputOverlayComponent): void {
    this.homeNav.useCurrentLocation(input);
  }

  updateMap(
    input: InputOverlayComponent,
    lat: number,
    lon: number,
    radiusKm?: number,
    zoomLevel?: number
  ): Promise<void> {
    return this.planeOps.updateMap(input, lat, lon, radiusKm, zoomLevel);
  }

  getWindFromDirection(deg: number): string {
    return this.uiControls.getWindFromDirection(deg);
  }

  getCurrentWindSpeed(): number {
    return this.uiControls.getCurrentWindSpeed();
  }

  getCurrentWindUnit(): string {
    return this.uiControls.getCurrentWindUnit();
  }

  cycleWindUnit(): void {
    this.uiControls.cycleWindUnit();
  }

  resolveAndUpdateFromAddress(input: InputOverlayComponent): void {
    if (!this.runtime.map) return;
    this.addressResolution.resolveAndUpdateFromAddress(
      input,
      (lat, lon, radius, zoom) => this.updateMap(input, lat, lon, radius, zoom),
      this.runtime.map.getZoom()
    );
  }

  onExcludeDiscountChange(): void {
    this.planeFiltering.onExcludeDiscountChange(
      this.runtime.planeLog,
      this.runtime.planeHistoricalLog,
      this.runtime.map
    );
  }

  toggleConeVisibility(show: boolean, cdr: ChangeDetectorRef): void {
    this.weatherUi.toggleConeVisibility(show, cdr);
  }

  onConeConfigChange(cones: ViewConeConfig[], cdr: ChangeDetectorRef): void {
    this.weatherUi.onConeConfigChange(cones, cdr);
  }

  onConeConfig(): void {
    this.weatherUi.onConeConfig();
  }

  toggleCloudCover(show: boolean): void {
    this.weatherUi.toggleCloudCover(show);
  }

  toggleRainCover(show: boolean): void {
    this.weatherUi.toggleRainCover(show);
  }

  followNearestPlane(plane: PlaneLogEntry, cdr: ChangeDetectorRef): void {
    this.followHandlers.followNearestPlane(plane, cdr);
  }

  onCenterAirport(coords: { lat: number; lon: number }): void {
    this.uiControls.onCenterAirport(coords);
  }

  onWindowResize(cdr: ChangeDetectorRef): void {
    this.uiControls.onWindowResize(cdr);
  }

  onHoverOverlayPlane(plane: PlaneLogEntry): void {
    this.followHandlers.onHoverOverlayPlane(plane);
  }

  onUnhoverOverlayPlane(plane: PlaneLogEntry): void {
    this.followHandlers.onUnhoverOverlayPlane(plane);
  }

  onToggleAltitudeBorders(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiControls.onToggleAltitudeBorders(enabled, cdr);
  }

  onToggleAnimations(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiControls.onToggleAnimations(enabled, cdr);
  }

  onToggleWindDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiControls.onToggleWindDirection(enabled, cdr);
  }

  onToggleSunDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiControls.onToggleSunDirection(enabled, cdr);
  }

  onToggleDateTimeOverlays(): void {
    this.uiControls.onToggleDateTimeOverlays();
  }

  onWindowViewToggle(show: boolean): void {
    this.uiControls.onWindowViewToggle(show);
  }

  toggleBrightness(): void {
    this.uiControls.toggleBrightness();
  }
}
