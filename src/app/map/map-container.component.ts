/**
 * Refactored Map Container Component
 * Focused component that coordinates services and handles only essential map container logic
 */

import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Subject,
  takeUntil,
  combineLatest,
  distinctUntilChanged,
  debounceTime,
  map,
  Observable,
} from 'rxjs';

// Services
import { MapInfrastructureService } from '../services/map-infrastructure.service';
import { PlaneDataOrchestratorService } from '../services/plane-data-orchestrator.service';
import { EnvironmentalDataService } from '../services/environmental-data.service';
import { MapStateManagerService } from '../services/map-state-manager.service';
import { SettingsService } from '../services/settings.service';
import { ScanService } from '../services/scan.service';

// Event types
interface PlaneSelectionEvent {
  icao: string;
  action: 'center' | 'follow' | 'info';
}

interface LocationChangeEvent {
  lat: number;
  lon: number;
  radius?: number;
  zoom?: number;
}

interface ToggleChangeEvent {
  key: string;
  value: boolean;
}

interface SettingChangeEvent {
  key: string;
  value: any;
}

interface ActionEvent {
  action: string;
  data?: any;
}

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-container.component.html',
  styleUrls: ['./map-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  // Observable streams for template - initialize after services are available
  public planeDataState$!: Observable<any>;
  public environmentalState$!: Observable<any>;
  public uiState$!: Observable<any>;
  public uiToggles$!: Observable<any>;
  public followState$!: Observable<any>;
  public environmentalSettings$!: Observable<any>;
  public isLoading$!: Observable<boolean>;

  private destroy$ = new Subject<void>();
  private initialized = false;

  constructor(
    private mapInfrastructure: MapInfrastructureService,
    private planeDataOrchestrator: PlaneDataOrchestratorService,
    private environmentalData: EnvironmentalDataService,
    private mapStateManager: MapStateManagerService,
    private settings: SettingsService,
    private scanService: ScanService,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit(): void {
    // Initialize observables after dependency injection is complete
    this.planeDataState$ = this.planeDataOrchestrator.state$;
    this.environmentalState$ = this.environmentalData.state$;
    this.uiState$ = this.mapStateManager.state$;
    this.uiToggles$ = this.mapStateManager.uiToggles$;
    this.followState$ = this.mapStateManager.followState$;
    this.environmentalSettings$ = this.mapStateManager.environmentalSettings$;
    this.isLoading$ = combineLatest([
      this.planeDataOrchestrator.isLoading$,
      this.environmentalData.state$.pipe(map((state: any) => state.isLoading)),
    ]).pipe(
      map(
        ([planesLoading, envLoading]: [boolean, boolean]) =>
          planesLoading || envLoading
      )
    );

    this.setupStateSubscriptions();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.setupDataRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.mapInfrastructure.destroy();
    this.scanService.stop();
  }
  /**
   * Handle plane selection from overlays (placeholder)
   */
  onPlaneSelected(event: PlaneSelectionEvent): void {
    switch (event.action) {
      case 'follow':
        this.mapStateManager.startFollowingPlane(event.icao);
        break;
      case 'center':
        this.centerOnPlane(event.icao);
        break;
      case 'info':
        this.showPlaneInfo(event.icao);
        break;
    }
  }

  /**
   * Handle location changes from controls (placeholder)
   */
  onLocationChanged(event: LocationChangeEvent): void {
    // Update map view
    this.mapStateManager.updateView({
      center: { lat: event.lat, lon: event.lon },
      ...(event.zoom && { zoom: event.zoom }),
    });

    // Update environmental data location
    this.environmentalData.setLocation(event.lat, event.lon);

    // Update plane data for new location
    const radius =
      event.radius || this.mapStateManager.getCurrentState().radius;
    this.refreshPlanesForLocation(event.lat, event.lon, radius);
  }

  /**
   * Handle UI toggle changes (placeholder)
   */
  onToggleChanged(event: ToggleChangeEvent): void {
    const toggles = this.mapStateManager.getCurrentState().uiToggles;
    this.mapStateManager.updateUIToggles({
      ...toggles,
      [event.key]: event.value,
    });
  }

  /**
   * Handle setting changes (placeholder)
   */
  onSettingChanged(event: SettingChangeEvent): void {
    const settings =
      this.mapStateManager.getCurrentState().environmentalSettings;
    this.mapStateManager.updateEnvironmentalSettings({
      ...settings,
      [event.key]: event.value,
    });
  }

  /**
   * Handle action triggers from controls (placeholder)
   */
  onActionTriggered(event: ActionEvent): void {
    switch (event.action) {
      case 'useCurrentLocation':
        this.useCurrentLocation();
        break;
      case 'setHome':
        this.setCurrentAsHome();
        break;
      case 'goHome':
        this.goToHome();
        break;
      case 'refreshData':
        this.refreshAllData();
        break;
      case 'clearSeen':
        this.clearSeenPlanes();
        break;
      case 'followNearest':
        this.mapStateManager.startFollowingNearest();
        break;
      case 'stopFollowing':
        this.mapStateManager.stopFollowing();
        break;
    }
  }

  /**
   * Initialize the map
   */
  private initializeMap(): void {
    const state = this.mapStateManager.getCurrentState();

    const mapConfig = {
      center: [state.view.center.lat, state.view.center.lon] as [
        number,
        number
      ],
      zoom: state.view.zoom,
      minZoom: 2,
      maxZoom: 18,
      tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    };

    const map = this.mapInfrastructure.initializeMap('map', mapConfig);

    // Setup map event listeners
    this.setupMapEventListeners(map);

    // Initialize environmental data
    this.environmentalData.setLocation(
      state.view.center.lat,
      state.view.center.lon
    );

    this.initialized = true;
    this.cdr.detectChanges();
  }

  /**
   * Setup map event listeners
   */
  private setupMapEventListeners(map: L.Map): void {
    // Update state when map view changes
    map.on('moveend zoomend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();

      this.mapStateManager.updateView({
        center: { lat: center.lat, lon: center.lng },
        zoom: zoom,
      });
    });

    // Handle resize events
    map.on('resize', () => {
      this.mapStateManager.updateOverlayStates({ isResizing: true });

      // Debounce resize end
      setTimeout(() => {
        this.mapStateManager.updateOverlayStates({ isResizing: false });
      }, 500);
    });
  }

  /**
   * Setup state subscriptions
   */
  private setupStateSubscriptions(): void {
    // React to view changes
    this.mapStateManager.view$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(),
        debounceTime(100) // Debounce rapid changes
      )
      .subscribe((view) => {
        if (this.initialized) {
          this.mapInfrastructure.setView(
            [view.center.lat, view.center.lon],
            view.zoom,
            { animate: true, duration: 1.0 }
          );
        }
      });

    // React to follow state changes
    this.mapStateManager.followState$
      .pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe((followState) => {
        this.handleFollowStateChange(followState);
      });

    // React to plane data changes for following
    this.planeDataOrchestrator.activePlanes$
      .pipe(takeUntil(this.destroy$))
      .subscribe((planes) => {
        this.updateFollowedPlanePosition(planes);
      });
  }

  /**
   * Setup automatic data refresh
   */
  private setupDataRefresh(): void {
    // Start scan service
    this.scanService.start(this.settings.interval, () => {
      const state = this.mapStateManager.getCurrentState();
      this.refreshPlanesForLocation(
        state.view.center.lat,
        state.view.center.lon,
        state.radius
      );
    });

    // Initial data load
    this.refreshAllData();
  }

  /**
   * Refresh all data
   */
  private refreshAllData(): void {
    const state = this.mapStateManager.getCurrentState();

    // Refresh environmental data
    this.environmentalData.refreshEnvironmentalData();

    // Refresh plane data
    this.refreshPlanesForLocation(
      state.view.center.lat,
      state.view.center.lon,
      state.radius
    );
  }

  /**
   * Refresh planes for a specific location
   */
  private refreshPlanesForLocation(
    lat: number,
    lon: number,
    radius: number
  ): void {
    this.planeDataOrchestrator
      .refreshPlanes(lat, lon, radius)
      .catch((error) => {
        console.error('Failed to refresh planes:', error);
      });
  }

  /**
   * Handle follow state changes
   */
  private handleFollowStateChange(followState: any): void {
    if (followState.mode === 'none') {
      // Stop tracking
      return;
    }

    if (followState.followedPlaneIcao && followState.trackingActive) {
      const plane = this.planeDataOrchestrator.getPlane(
        followState.followedPlaneIcao
      );
      if (plane && plane.lat && plane.lon) {
        this.mapInfrastructure.panTo([plane.lat, plane.lon], {
          animate: true,
          duration: 1.5,
        });
      }
    }
  }

  /**
   * Update followed plane position tracking
   */
  private updateFollowedPlanePosition(planes: any[]): void {
    const followState = this.mapStateManager.getCurrentState().followState;

    if (!followState.trackingActive || !followState.followedPlaneIcao) return;

    const followedPlane = planes.find(
      (p) => p.icao === followState.followedPlaneIcao
    );
    if (followedPlane && followedPlane.lat && followedPlane.lon) {
      const currentCenter = this.mapInfrastructure.getCenter();
      if (!currentCenter) return;

      // Calculate distance from current center
      const distance = this.calculateDistance(
        currentCenter.lat,
        currentCenter.lng,
        followedPlane.lat,
        followedPlane.lon
      );

      // Only pan if plane has moved significantly (>50m)
      if (distance > 0.05) {
        this.mapInfrastructure.panTo([followedPlane.lat, followedPlane.lon], {
          animate: true,
          duration: 1.5,
        });
      }
    }
  }

  /**
   * Center map on specific plane
   */
  private centerOnPlane(icao: string): void {
    const plane = this.planeDataOrchestrator.getPlane(icao);
    if (plane && plane.lat && plane.lon) {
      this.mapInfrastructure.panTo([plane.lat, plane.lon], {
        animate: true,
        duration: 1.0,
      });
    }
  }

  /**
   * Show plane information
   */
  private showPlaneInfo(icao: string): void {
    // This would trigger an overlay or modal with plane details
    console.log('Show info for plane:', icao);
  }

  /**
   * Use current location
   */
  private useCurrentLocation(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.onLocationChanged({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }

  /**
   * Set current location as home
   */
  private setCurrentAsHome(): void {
    const state = this.mapStateManager.getCurrentState();
    this.mapStateManager.setHomeLocation(
      state.view.center.lat,
      state.view.center.lon
    );
  }

  /**
   * Go to home location
   */
  private goToHome(): void {
    const homeLocation = this.mapStateManager.getCurrentState().homeLocation;
    if (homeLocation) {
      this.onLocationChanged({
        lat: homeLocation.lat,
        lon: homeLocation.lon,
      });
    }
  }

  /**
   * Clear seen planes
   */
  private clearSeenPlanes(): void {
    this.planeDataOrchestrator.clearPlanes();
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
