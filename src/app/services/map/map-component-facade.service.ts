import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { AddressResolutionService } from '../address-resolution/address-resolution.service';
import { PlaneFilteringService } from '../plane-filtering/plane-filtering.service';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapUiControlsService } from './map-ui-controls.service';
import { MapWeatherUiService } from './map-weather-ui.service';
import { MapHomeNavigationService } from './map-home-navigation.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapFollowHandlersService } from './map-follow-handlers.service';
import {
  mapCurrentLat,
  mapCurrentLon,
  mapRadiusKm,
  mapHomeLocationValue,
  mapIsAtHome,
} from './map-location-query.util';
import {
  createMapComponentDelegates,
  type MapComponentDelegateMethods,
} from './map-component-delegates.util';

/** Template-facing map actions and location getters (keeps MapComponent under budget). */
@Injectable({ providedIn: 'root' })
export class MapComponentFacadeService implements MapComponentDelegateMethods {
  constructor(
    public runtime: MapRuntimeService,
    public overlay: MapOverlayStateService,
    private settings: SettingsService,
    uiControls: MapUiControlsService,
    weatherUi: MapWeatherUiService,
    homeNav: MapHomeNavigationService,
    planeOps: MapPlaneOperationsService,
    followHandlers: MapFollowHandlersService,
    addressResolution: AddressResolutionService,
    planeFiltering: PlaneFilteringService
  ) {
    Object.assign(
      this,
      createMapComponentDelegates({
        runtime: this.runtime,
        uiControls,
        weatherUi,
        homeNav,
        planeOps,
        followHandlers,
        addressResolution,
        planeFiltering,
      })
    );
  }

  onZoomIn!: MapComponentDelegateMethods['onZoomIn'];
  onZoomOut!: MapComponentDelegateMethods['onZoomOut'];
  onToggleAirportLabels!: MapComponentDelegateMethods['onToggleAirportLabels'];
  setCurrentAsHome!: MapComponentDelegateMethods['setCurrentAsHome'];
  goToHome!: MapComponentDelegateMethods['goToHome'];
  useCurrentLocation!: MapComponentDelegateMethods['useCurrentLocation'];
  updateMap!: MapComponentDelegateMethods['updateMap'];
  getWindFromDirection!: MapComponentDelegateMethods['getWindFromDirection'];
  getCurrentWindSpeed!: MapComponentDelegateMethods['getCurrentWindSpeed'];
  getCurrentWindUnit!: MapComponentDelegateMethods['getCurrentWindUnit'];
  cycleWindUnit!: MapComponentDelegateMethods['cycleWindUnit'];
  resolveAndUpdateFromAddress!: MapComponentDelegateMethods['resolveAndUpdateFromAddress'];
  onExcludeDiscountChange!: MapComponentDelegateMethods['onExcludeDiscountChange'];
  toggleConeVisibility!: MapComponentDelegateMethods['toggleConeVisibility'];
  onConeConfigChange!: MapComponentDelegateMethods['onConeConfigChange'];
  onConeConfig!: MapComponentDelegateMethods['onConeConfig'];
  toggleCloudCover!: MapComponentDelegateMethods['toggleCloudCover'];
  toggleRainCover!: MapComponentDelegateMethods['toggleRainCover'];
  followNearestPlane!: MapComponentDelegateMethods['followNearestPlane'];
  onCenterAirport!: MapComponentDelegateMethods['onCenterAirport'];
  onWindowResize!: MapComponentDelegateMethods['onWindowResize'];
  onHoverOverlayPlane!: MapComponentDelegateMethods['onHoverOverlayPlane'];
  onUnhoverOverlayPlane!: MapComponentDelegateMethods['onUnhoverOverlayPlane'];
  onToggleAltitudeBorders!: MapComponentDelegateMethods['onToggleAltitudeBorders'];
  onToggleAnimations!: MapComponentDelegateMethods['onToggleAnimations'];
  onToggleGhostPosition!: MapComponentDelegateMethods['onToggleGhostPosition'];
  onToggleWindDirection!: MapComponentDelegateMethods['onToggleWindDirection'];
  onToggleSunDirection!: MapComponentDelegateMethods['onToggleSunDirection'];
  onToggleDateTimeOverlays!: MapComponentDelegateMethods['onToggleDateTimeOverlays'];
  onWindowViewToggle!: MapComponentDelegateMethods['onWindowViewToggle'];
  toggleBrightness!: MapComponentDelegateMethods['toggleBrightness'];

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
}
