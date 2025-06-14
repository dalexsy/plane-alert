/**
 * Map State Manager Service
 * Centralized state management for all map-related UI and data
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { PlaneModel } from '../models/plane-model';

export interface ViewState {
  center: { lat: number; lon: number };
  zoom: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

export interface UIToggles {
  showDateTime: boolean;
  showCloudCover: boolean;
  showRainCover: boolean;
  showViewAxes: boolean;
  showAirportLabels: boolean;
  showAltitudeBorders: boolean;
  coneVisible: boolean;
  cloudVisible: boolean;
  rainVisible: boolean;
}

export interface OverlayStates {
  inputOverlayCollapsed: boolean;
  seenCollapsed: boolean;
  resultsVisible: boolean;
  locationOverlayVisible: boolean;
  windowViewVisible: boolean;
  isResizing: boolean;
  loadingAirports: boolean;
}

export interface FollowState {
  mode: 'none' | 'manual' | 'nearest' | 'shuffle';
  followedPlaneIcao: string | null;
  followNearest: boolean;
  trackingActive: boolean;
}

export interface EnvironmentalSettings {
  cloudOpacity: number;
  rainOpacity: number;
  brightness: number;
  windUnitIndex: number;
}

export interface MapState {
  view: ViewState;
  uiToggles: UIToggles;
  overlayStates: OverlayStates;
  followState: FollowState;
  environmentalSettings: EnvironmentalSettings;
  homeLocation: { lat: number; lon: number } | null;
  radius: number;
  lastUpdate: number;
}

// Default state
const initialState: MapState = {
  view: {
    center: { lat: 40.7128, lon: -74.006 }, // NYC default
    zoom: 10,
  },
  uiToggles: {
    showDateTime: true,
    showCloudCover: true,
    showRainCover: true,
    showViewAxes: false,
    showAirportLabels: true,
    showAltitudeBorders: false,
    coneVisible: false,
    cloudVisible: true,
    rainVisible: true,
  },
  overlayStates: {
    inputOverlayCollapsed: false,
    seenCollapsed: false,
    resultsVisible: true,
    locationOverlayVisible: true,
    windowViewVisible: true,
    isResizing: false,
    loadingAirports: false,
  },
  followState: {
    mode: 'none',
    followedPlaneIcao: null,
    followNearest: false,
    trackingActive: false,
  },
  environmentalSettings: {
    cloudOpacity: 1.0,
    rainOpacity: 0.8,
    brightness: 1.0,
    windUnitIndex: 0,
  },
  homeLocation: null,
  radius: 5,
  lastUpdate: Date.now(),
};

@Injectable({
  providedIn: 'root',
})
export class MapStateManagerService {
  private stateSubject = new BehaviorSubject<MapState>(initialState);

  public state$ = this.stateSubject.asObservable();

  // Derived observables for specific parts of state
  public view$ = this.state$.pipe(
    map((state) => state.view),
    distinctUntilChanged()
  );

  public uiToggles$ = this.state$.pipe(
    map((state) => state.uiToggles),
    distinctUntilChanged()
  );

  public overlayStates$ = this.state$.pipe(
    map((state) => state.overlayStates),
    distinctUntilChanged()
  );

  public followState$ = this.state$.pipe(
    map((state) => state.followState),
    distinctUntilChanged()
  );

  public environmentalSettings$ = this.state$.pipe(
    map((state) => state.environmentalSettings),
    distinctUntilChanged()
  );

  public homeLocation$ = this.state$.pipe(
    map((state) => state.homeLocation),
    distinctUntilChanged()
  );

  // Convenience observables for commonly accessed properties
  public isAtHome$ = combineLatest([this.view$, this.homeLocation$]).pipe(
    map(([view, home]) => {
      if (!home) return false;
      const tolerance = 1e-6;
      return (
        Math.abs(view.center.lat - home.lat) < tolerance &&
        Math.abs(view.center.lon - home.lon) < tolerance
      );
    }),
    distinctUntilChanged()
  );

  public isFollowingPlane$ = this.followState$.pipe(
    map((state) => state.mode !== 'none' && state.followedPlaneIcao !== null),
    distinctUntilChanged()
  );

  constructor() {
    this.loadStateFromStorage();
  }

  /**
   * Update map view
   */
  updateView(updates: Partial<ViewState>): void {
    this.updateState({
      view: { ...this.currentState.view, ...updates },
    });
  }

  /**
   * Update UI toggles
   */
  updateUIToggles(updates: Partial<UIToggles>): void {
    this.updateState({
      uiToggles: { ...this.currentState.uiToggles, ...updates },
    });
    this.saveUITogglesToStorage(updates);
  }

  /**
   * Update overlay states
   */
  updateOverlayStates(updates: Partial<OverlayStates>): void {
    this.updateState({
      overlayStates: { ...this.currentState.overlayStates, ...updates },
    });
  }

  /**
   * Update follow state
   */
  updateFollowState(updates: Partial<FollowState>): void {
    this.updateState({
      followState: { ...this.currentState.followState, ...updates },
    });
  }

  /**
   * Update environmental settings
   */
  updateEnvironmentalSettings(updates: Partial<EnvironmentalSettings>): void {
    this.updateState({
      environmentalSettings: {
        ...this.currentState.environmentalSettings,
        ...updates,
      },
    });
    this.saveEnvironmentalSettingsToStorage(updates);
  }

  /**
   * Set home location
   */
  setHomeLocation(lat: number, lon: number): void {
    const homeLocation = { lat, lon };
    this.updateState({ homeLocation });
    localStorage.setItem('homeLocation', JSON.stringify(homeLocation));
  }

  /**
   * Clear home location
   */
  clearHomeLocation(): void {
    this.updateState({ homeLocation: null });
    localStorage.removeItem('homeLocation');
  }

  /**
   * Update search radius
   */
  setRadius(radius: number): void {
    this.updateState({ radius: Math.min(radius, 500) }); // Cap at 500km
    localStorage.setItem('radius', radius.toString());
  }

  /**
   * Start following a plane manually
   */
  startFollowingPlane(icao: string): void {
    this.updateFollowState({
      mode: 'manual',
      followedPlaneIcao: icao,
      followNearest: false,
      trackingActive: true,
    });
  }

  /**
   * Start following nearest plane
   */
  startFollowingNearest(): void {
    this.updateFollowState({
      mode: 'nearest',
      followNearest: true,
      trackingActive: true,
    });
  }

  /**
   * Start shuffle mode
   */
  startShuffleMode(): void {
    this.updateFollowState({
      mode: 'shuffle',
      trackingActive: true,
    });
  }

  /**
   * Stop all following modes
   */
  stopFollowing(): void {
    this.updateFollowState({
      mode: 'none',
      followedPlaneIcao: null,
      followNearest: false,
      trackingActive: false,
    });
  }

  /**
   * Toggle UI element
   */
  toggleUI(key: keyof UIToggles): void {
    const currentValue = this.currentState.uiToggles[key];
    this.updateUIToggles({ [key]: !currentValue } as Partial<UIToggles>);
  }

  /**
   * Toggle overlay
   */
  toggleOverlay(key: keyof OverlayStates): void {
    const currentValue = this.currentState.overlayStates[key];
    this.updateOverlayStates({
      [key]: !currentValue,
    } as Partial<OverlayStates>);
  }

  /**
   * Get current state snapshot
   */
  getCurrentState(): MapState {
    return this.currentState;
  }

  /**
   * Reset state to defaults
   */
  resetState(): void {
    this.stateSubject.next({ ...initialState, lastUpdate: Date.now() });
    this.clearLocalStorage();
  }

  /**
   * Get current state
   */
  private get currentState(): MapState {
    return this.stateSubject.value;
  }

  /**
   * Update state immutably
   */
  private updateState(updates: Partial<MapState>): void {
    const currentState = this.currentState;
    const newState = {
      ...currentState,
      ...updates,
      lastUpdate: Date.now(),
    };
    this.stateSubject.next(newState);
  }

  /**
   * Load state from localStorage
   */
  private loadStateFromStorage(): void {
    try {
      // Load UI toggles
      const savedToggles = this.loadUITogglesFromStorage();

      // Load environmental settings
      const savedEnvironmental = this.loadEnvironmentalSettingsFromStorage();

      // Load home location
      const homeLocationStr = localStorage.getItem('homeLocation');
      const homeLocation = homeLocationStr ? JSON.parse(homeLocationStr) : null;

      // Load radius
      const radiusStr = localStorage.getItem('radius');
      const radius = radiusStr ? parseFloat(radiusStr) : initialState.radius;

      // Load current location
      const latStr = localStorage.getItem('lat');
      const lonStr = localStorage.getItem('lon');
      const view =
        latStr && lonStr
          ? {
              ...initialState.view,
              center: { lat: parseFloat(latStr), lon: parseFloat(lonStr) },
            }
          : initialState.view;

      this.updateState({
        view,
        uiToggles: { ...initialState.uiToggles, ...savedToggles },
        environmentalSettings: {
          ...initialState.environmentalSettings,
          ...savedEnvironmental,
        },
        homeLocation,
        radius,
      });
    } catch (error) {
      console.warn('Failed to load state from storage:', error);
    }
  }

  /**
   * Load UI toggles from localStorage
   */
  private loadUITogglesFromStorage(): Partial<UIToggles> {
    const toggles: Partial<UIToggles> = {};

    const booleanSettings = [
      'showDateTime',
      'showCloudCover',
      'showRainCover',
      'showViewAxes',
      'showAirportLabels',
      'showAltitudeBorders',
    ];

    booleanSettings.forEach((setting) => {
      const value = localStorage.getItem(setting);
      if (value !== null) {
        (toggles as any)[setting] = value === 'true';
      }
    });

    return toggles;
  }

  /**
   * Load environmental settings from localStorage
   */
  private loadEnvironmentalSettingsFromStorage(): Partial<EnvironmentalSettings> {
    const settings: Partial<EnvironmentalSettings> = {};

    const windUnitIndex = localStorage.getItem('windUnitIndex');
    if (windUnitIndex !== null) {
      settings.windUnitIndex = parseInt(windUnitIndex, 10);
    }

    // Add other environmental settings as needed

    return settings;
  }

  /**
   * Save UI toggles to localStorage
   */
  private saveUITogglesToStorage(updates: Partial<UIToggles>): void {
    Object.entries(updates).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });
  }

  /**
   * Save environmental settings to localStorage
   */
  private saveEnvironmentalSettingsToStorage(
    updates: Partial<EnvironmentalSettings>
  ): void {
    Object.entries(updates).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });
  }

  /**
   * Clear all localStorage
   */
  private clearLocalStorage(): void {
    const keysToRemove = [
      'lat',
      'lon',
      'radius',
      'homeLocation',
      'showDateTime',
      'showCloudCover',
      'showRainCover',
      'showViewAxes',
      'showAirportLabels',
      'showAltitudeBorders',
      'windUnitIndex',
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}
