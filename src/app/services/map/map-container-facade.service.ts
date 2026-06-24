import { Injectable, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import * as L from 'leaflet';
import { MapInfrastructureService } from '../../services/map-infrastructure.service';
import { PlaneDataOrchestratorService } from '../../services/plane-data-orchestrator.service';
import { EnvironmentalDataService } from '../../services/environmental-data.service';
import { MapStateManagerService } from '../../services/map-state-manager.service';
import { SettingsService } from '../../services/settings.service';
import { ScanService } from '../../services/scan.service';
import { LocationUpdateService } from '../../services/location-update.service';
import { UrlParameterService } from '../../services/url-parameter.service';
import { haversineDistance } from '../../utils/geo-utils';

export interface MapLocationChangeEvent {
  lat: number;
  lon: number;
  radius?: number;
  zoom?: number;
}

@Injectable({ providedIn: 'root' })
export class MapContainerFacadeService {
  initialized = false;

  constructor(
    private mapInfrastructure: MapInfrastructureService,
    private planeDataOrchestrator: PlaneDataOrchestratorService,
    private environmentalData: EnvironmentalDataService,
    private mapStateManager: MapStateManagerService,
    private settings: SettingsService,
    private scanService: ScanService,
    private locationUpdateService: LocationUpdateService,
    private urlParameterService: UrlParameterService
  ) {}

  checkUrlParameters(): void {
    this.urlParameterService.checkUrlParameters();
  }

  initializeMap(cdr: ChangeDetectorRef): void {
    const state = this.mapStateManager.getCurrentState();
    const map = this.mapInfrastructure.initializeMap('map', {
      center: [state.view.center.lat, state.view.center.lon],
      zoom: state.view.zoom,
      minZoom: 2,
      maxZoom: 18,
      tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
    this.setupMapEventListeners(map);
    this.environmentalData.setLocation(
      state.view.center.lat,
      state.view.center.lon
    );
    this.initialized = true;
    cdr.detectChanges();
  }

  setupStateSubscriptions(destroy$: Subject<void>): void {
    this.mapStateManager.view$
      .pipe(takeUntil(destroy$), distinctUntilChanged(), debounceTime(100))
      .subscribe((view) => {
        if (!this.initialized) return;
        this.mapInfrastructure.setView(
          [view.center.lat, view.center.lon],
          view.zoom,
          { animate: true, duration: 1.0 }
        );
      });
    this.mapStateManager.followState$
      .pipe(takeUntil(destroy$), distinctUntilChanged())
      .subscribe((followState) => this.handleFollowStateChange(followState));
    this.planeDataOrchestrator.activePlanes$
      .pipe(takeUntil(destroy$))
      .subscribe((planes) => this.updateFollowedPlanePosition(planes));
  }

  setupDataRefresh(): void {
    this.scanService.start(this.settings.interval, () => {
      const state = this.mapStateManager.getCurrentState();
      this.refreshPlanesForLocation(
        state.view.center.lat,
        state.view.center.lon,
        state.radius
      );
    });
    this.refreshAllData();
  }

  startAutoLocationTracking(onLocation: (e: MapLocationChangeEvent) => void): void {
    if (!navigator.geolocation || !this.settings.getHomeLocation()) return;
    this.locationUpdateService.startAutoLocationUpdates(
      (lat, lon, radius) => onLocation({ lat, lon, radius })
    );
  }

  destroy(): void {
    this.mapInfrastructure.destroy();
    this.scanService.stop();
    this.locationUpdateService.stopAutoLocationUpdates();
  }

  onPlaneSelected(
    icao: string,
    action: 'center' | 'follow' | 'info'
  ): void {
    if (action === 'follow') {
      this.mapStateManager.startFollowingPlane(icao);
    } else if (action === 'center') {
      this.centerOnPlane(icao);
    } else {
      console.log('Show info for plane:', icao);
    }
  }

  onLocationChanged(event: MapLocationChangeEvent): void {
    this.mapStateManager.updateView({
      center: { lat: event.lat, lon: event.lon },
      zoom: event.zoom ?? this.mapStateManager.getCurrentState().view.zoom,
    });
    if (event.radius != null) {
      this.mapStateManager.setRadius(event.radius);
    }
    this.environmentalData.setLocation(event.lat, event.lon);
    this.refreshPlanesForLocation(
      event.lat,
      event.lon,
      event.radius ?? this.mapStateManager.getCurrentState().radius
    );
  }

  onToggleChanged(key: string, value: boolean): void {
    this.mapStateManager.updateUIToggles({ [key]: value });
  }

  onSettingChanged(key: string, value: unknown): void {
    this.mapStateManager.updateEnvironmentalSettings({ [key]: value });
  }

  onAction(action: string): void {
    switch (action) {
      case 'useCurrentLocation':
        this.useCurrentLocation();
        break;
      case 'setHome':
        this.setCurrentAsHome();
        break;
      case 'goHome':
        this.goToHome();
        break;
      case 'clearSeen':
        this.planeDataOrchestrator.clearPlanes();
        break;
      default:
        break;
    }
  }

  private setupMapEventListeners(map: L.Map): void {
    map.on('moveend zoomend', () => {
      const center = map.getCenter();
      this.mapStateManager.updateView({
        center: { lat: center.lat, lon: center.lng },
        zoom: map.getZoom(),
      });
    });
    map.on('resize', () => {
      this.mapStateManager.updateOverlayStates({ isResizing: true });
      setTimeout(
        () => this.mapStateManager.updateOverlayStates({ isResizing: false }),
        500
      );
    });
  }

  private refreshAllData(): void {
    const state = this.mapStateManager.getCurrentState();
    this.environmentalData.refreshEnvironmentalData();
    this.refreshPlanesForLocation(
      state.view.center.lat,
      state.view.center.lon,
      state.radius
    );
  }

  private refreshPlanesForLocation(
    lat: number,
    lon: number,
    radius: number
  ): void {
    this.planeDataOrchestrator
      .refreshPlanes(lat, lon, radius)
      .catch((error) => console.error('Failed to refresh planes:', error));
  }

  private handleFollowStateChange(followState: {
    mode: string;
    followedPlaneIcao?: string;
    trackingActive?: boolean;
  }): void {
    if (followState.mode === 'none' || !followState.followedPlaneIcao) return;
    if (!followState.trackingActive) return;
    const plane = this.planeDataOrchestrator.getPlane(followState.followedPlaneIcao);
    if (plane?.lat && plane?.lon) {
      this.mapInfrastructure.panTo([plane.lat, plane.lon], {
        animate: true,
        duration: 1.5,
      });
    }
  }

  private updateFollowedPlanePosition(planes: Array<{ icao: string; lat?: number; lon?: number }>): void {
    const followState = this.mapStateManager.getCurrentState().followState;
    if (!followState.trackingActive || !followState.followedPlaneIcao) return;
    const followed = planes.find((p) => p.icao === followState.followedPlaneIcao);
    if (!followed?.lat || !followed?.lon) return;
    const center = this.mapInfrastructure.getCenter();
    if (!center) return;
    const distance = haversineDistance(
      center.lat,
      center.lng,
      followed.lat,
      followed.lon
    );
    if (distance > 0.05) {
      this.mapInfrastructure.panTo([followed.lat, followed.lon], {
        animate: true,
        duration: 1.5,
      });
    }
  }

  private centerOnPlane(icao: string): void {
    const plane = this.planeDataOrchestrator.getPlane(icao);
    if (plane?.lat && plane?.lon) {
      this.mapInfrastructure.panTo([plane.lat, plane.lon], {
        animate: true,
        duration: 1.0,
      });
    }
  }

  private useCurrentLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        this.onLocationChanged({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }

  private setCurrentAsHome(): void {
    const state = this.mapStateManager.getCurrentState();
    this.mapStateManager.setHomeLocation(
      state.view.center.lat,
      state.view.center.lon
    );
  }

  private goToHome(): void {
    const home = this.mapStateManager.getCurrentState().homeLocation;
    if (home) this.onLocationChanged({ lat: home.lat, lon: home.lon });
  }
}
