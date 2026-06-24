import { Injectable } from '@angular/core';
import { MapRuntimeService } from './map-runtime.service';
import { MapInitializerService } from '../map-initializer.service';
import { SettingsService } from '../settings.service';
import { LocationContextService } from '../location-context.service';
import { UiStateService } from '../ui-state.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';

@Injectable({ providedIn: 'root' })
export class MapHomeNavigationService {
  constructor(
    private runtime: MapRuntimeService,
    private mapInitializerService: MapInitializerService,
    private settings: SettingsService,
    private locationContext: LocationContextService,
    private uiState: UiStateService,
    private planeOps: MapPlaneOperationsService
  ) {}

  setHomeMarker(lat: number, lon: number): void {
    if (this.runtime.homeMarker) {
      this.runtime.homeMarker.remove();
    }
    this.runtime.homeMarker = this.mapInitializerService.initializeHomeMarker({
      lat,
      lon,
    });
  }

  setCurrentAsHome(): void {
    const lat = this.settings.lat;
    const lon = this.settings.lon;
    if (lat !== null && lon !== null) {
      const currentAddress = this.locationContext.currentLocation.address;
      this.settings.setHomeLocation(lat, lon, currentAddress || undefined);
      this.setHomeMarker(lat, lon);
    }
  }

  goToHome(
    inputOverlayComponent: Parameters<MapPlaneOperationsService['updateMap']>[0]
  ): void {
    const homeLocation = this.settings.getHomeLocation();
    if (!homeLocation) return;

    this.uiState.setConeVisibility(true);
    const coneCheckbox = document.getElementById('showCone') as HTMLInputElement;
    if (coneCheckbox) coneCheckbox.checked = true;

    const radius = this.settings.radius ?? 5;
    this.planeOps.updateMap(
      inputOverlayComponent,
      homeLocation.lat,
      homeLocation.lon,
      radius
    );

    if (homeLocation.address) {
      this.locationContext.setLocation(
        homeLocation.lat,
        homeLocation.lon,
        homeLocation.address,
        'home'
      );
      this.settings.setLocationWithAddress(
        homeLocation.lat,
        homeLocation.lon,
        homeLocation.address
      );
    } else {
      this.planeOps.reverseGeocode(homeLocation.lat, homeLocation.lon).then((address) => {
        this.locationContext.setLocation(
          homeLocation.lat,
          homeLocation.lon,
          address,
          'home'
        );
        this.settings.setLocationWithAddress(
          homeLocation.lat,
          homeLocation.lon,
          address
        );
        this.settings.setHomeLocation(homeLocation.lat, homeLocation.lon, address);
      });
    }
  }

  useCurrentLocation(
    inputOverlayComponent: Parameters<MapPlaneOperationsService['updateMap']>[0]
  ): void {
    this.uiState.setConeVisibility(false);
    const coneCheckbox = document.getElementById('showCone') as HTMLInputElement;
    if (coneCheckbox) coneCheckbox.checked = false;

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.runtime.locationErrorShown = false;
        const currentMainRadius = this.settings.radius ?? 5;
        this.planeOps.updateMap(
          inputOverlayComponent,
          position.coords.latitude,
          position.coords.longitude,
          currentMainRadius
        );
        this.locationContext.updateFromMapCenter(
          position.coords.latitude,
          position.coords.longitude,
          'current'
        );
        this.planeOps
          .reverseGeocode(position.coords.latitude, position.coords.longitude)
          .then((address) => {
            this.settings.setLocationWithAddress(
              position.coords.latitude,
              position.coords.longitude,
              address
            );
          });
      },
      () => {
        if (!this.runtime.locationErrorShown) {
          const currentMainRadius = this.settings.radius ?? 5;
          this.planeOps.updateMap(
            inputOverlayComponent,
            this.runtime.DEFAULT_COORDS[0],
            this.runtime.DEFAULT_COORDS[1],
            currentMainRadius
          );
          inputOverlayComponent.addressInputRef.setValue(
            'Unable to fetch location; using default'
          );
          this.runtime.locationErrorShown = true;
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }
}
