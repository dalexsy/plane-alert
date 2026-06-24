import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import {
  clearMapStateStorage,
  EnvironmentalSettings,
  FollowState,
  initialMapState,
  loadPersistedMapState,
  MapState,
  OverlayStates,
  saveEnvironmentalSettingsToStorage,
  saveUITogglesToStorage,
  UIToggles,
  ViewState,
} from './map-state-manager/map-state-types';

export type {
  EnvironmentalSettings,
  FollowState,
  MapState,
  OverlayStates,
  UIToggles,
  ViewState,
} from './map-state-manager/map-state-types';

@Injectable({ providedIn: 'root' })
export class MapStateManagerService {
  private stateSubject = new BehaviorSubject<MapState>(initialMapState);
  public state$ = this.stateSubject.asObservable();
  public view$ = this.state$.pipe(map((s) => s.view), distinctUntilChanged());
  public uiToggles$ = this.state$.pipe(map((s) => s.uiToggles), distinctUntilChanged());
  public overlayStates$ = this.state$.pipe(map((s) => s.overlayStates), distinctUntilChanged());
  public followState$ = this.state$.pipe(map((s) => s.followState), distinctUntilChanged());
  public environmentalSettings$ = this.state$.pipe(map((s) => s.environmentalSettings), distinctUntilChanged());
  public homeLocation$ = this.state$.pipe(map((s) => s.homeLocation), distinctUntilChanged());
  public isAtHome$ = combineLatest([this.view$, this.homeLocation$]).pipe(
    map(([view, home]) => {
      if (!home) return false;
      const tolerance = 1e-6;
      return Math.abs(view.center.lat - home.lat) < tolerance && Math.abs(view.center.lon - home.lon) < tolerance;
    }),
    distinctUntilChanged()
  );
  public isFollowingPlane$ = this.followState$.pipe(
    map((s) => s.mode !== 'none' && s.followedPlaneIcao !== null),
    distinctUntilChanged()
  );

  constructor() {
    this.updateState(loadPersistedMapState());
  }

  updateView(updates: Partial<ViewState>): void {
    this.updateState({ view: { ...this.currentState.view, ...updates } });
  }

  updateUIToggles(updates: Partial<UIToggles>): void {
    this.updateState({ uiToggles: { ...this.currentState.uiToggles, ...updates } });
    saveUITogglesToStorage(updates);
  }

  updateOverlayStates(updates: Partial<OverlayStates>): void {
    this.updateState({ overlayStates: { ...this.currentState.overlayStates, ...updates } });
  }

  updateFollowState(updates: Partial<FollowState>): void {
    this.updateState({ followState: { ...this.currentState.followState, ...updates } });
  }

  updateEnvironmentalSettings(updates: Partial<EnvironmentalSettings>): void {
    this.updateState({ environmentalSettings: { ...this.currentState.environmentalSettings, ...updates } });
    saveEnvironmentalSettingsToStorage(updates);
  }

  setHomeLocation(lat: number, lon: number): void {
    const homeLocation = { lat, lon };
    this.updateState({ homeLocation });
    localStorage.setItem('homeLocation', JSON.stringify(homeLocation));
  }

  clearHomeLocation(): void {
    this.updateState({ homeLocation: null });
    localStorage.removeItem('homeLocation');
  }

  setRadius(radius: number): void {
    this.updateState({ radius: Math.min(radius, 500) });
    localStorage.setItem('radius', radius.toString());
  }

  startFollowingPlane(icao: string): void {
    this.updateFollowState({ mode: 'manual', followedPlaneIcao: icao, followNearest: false, trackingActive: true });
  }

  startFollowingNearest(): void {
    this.updateFollowState({ mode: 'nearest', followNearest: true, trackingActive: true });
  }

  startShuffleMode(): void {
    this.updateFollowState({ mode: 'shuffle', trackingActive: true });
  }

  stopFollowing(): void {
    this.updateFollowState({ mode: 'none', followedPlaneIcao: null, followNearest: false, trackingActive: false });
  }

  toggleUI(key: keyof UIToggles): void {
    this.updateUIToggles({ [key]: !this.currentState.uiToggles[key] } as Partial<UIToggles>);
  }

  toggleOverlay(key: keyof OverlayStates): void {
    this.updateOverlayStates({ [key]: !this.currentState.overlayStates[key] } as Partial<OverlayStates>);
  }

  getCurrentState(): MapState {
    return this.currentState;
  }

  resetState(): void {
    this.stateSubject.next({ ...initialMapState, lastUpdate: Date.now() });
    clearMapStateStorage();
  }

  private get currentState(): MapState {
    return this.stateSubject.value;
  }

  private updateState(updates: Partial<MapState>): void {
    this.stateSubject.next({ ...this.currentState, ...updates, lastUpdate: Date.now() });
  }
}
