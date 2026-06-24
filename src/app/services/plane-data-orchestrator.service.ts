/**
 * Plane Data Orchestrator Service
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, distinctUntilChanged } from 'rxjs';
import { PlaneModel } from '../models/plane-model';
import { PlaneFinderService } from './plane-finder.service';
import { PlaneFilterService } from './plane-filter.service';
import { SettingsService } from './settings.service';
import {
  filterActivePlanes,
  haversineKm,
  hasPlaneDataChanged,
} from './plane-data-orchestrator/plane-data-orchestrator.util';

export interface PlaneDataState {
  planes: PlaneModel[];
  filteredPlanes: PlaneModel[];
  activePlanes: PlaneModel[];
  historicalPlanes: PlaneModel[];
  isLoading: boolean;
  lastUpdate: number;
  error?: string;
}

export interface PlaneUpdateResult {
  added: PlaneModel[];
  updated: PlaneModel[];
  removed: PlaneModel[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PlaneDataOrchestratorService {
  private stateSubject = new BehaviorSubject<PlaneDataState>({
    planes: [], filteredPlanes: [], activePlanes: [], historicalPlanes: [],
    isLoading: false, lastUpdate: 0,
  });
  public state$ = this.stateSubject.asObservable();
  public activePlanes$ = this.state$.pipe(map((s) => s.activePlanes), distinctUntilChanged());
  public filteredPlanes$ = this.state$.pipe(map((s) => s.filteredPlanes), distinctUntilChanged());
  public isLoading$ = this.state$.pipe(map((s) => s.isLoading), distinctUntilChanged());
  private planeCache = new Map<string, PlaneModel>();
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 30000;

  constructor(
    private planeFinder: PlaneFinderService,
    private planeFilter: PlaneFilterService,
    private settings: SettingsService
  ) {
    this.settings.excludeDiscountChanged.subscribe(() => this.applyFilters());
  }

  async refreshPlanes(lat: number, lon: number, radius: number): Promise<PlaneUpdateResult> {
    this.updateState({ isLoading: true });
    try {
      const currentTime = Date.now();
      if (currentTime - this.lastFetchTime < this.CACHE_DURATION) {
        const result = this.processPlaneUpdate(Array.from(this.planeCache.values()));
        this.updateState({ isLoading: false });
        return result;
      }
      const planes = await this.fetchPlanesFromAPI(lat, lon, radius);
      const result = this.processPlaneUpdate(planes);
      this.lastFetchTime = currentTime;
      this.updateState({ isLoading: false });
      return result;
    } catch (error) {
      this.handleError(error);
      this.updateState({ isLoading: false });
      throw error;
    }
  }

  updatePlane(icao: string, updates: Partial<PlaneModel>): void {
    const currentState = this.stateSubject.value;
    const planeIndex = currentState.planes.findIndex((p) => p.icao === icao);
    if (planeIndex === -1) return;
    const updatedPlanes = [...currentState.planes];
    const existingPlane = updatedPlanes[planeIndex];
    if (existingPlane && typeof existingPlane.updateFrom === 'function') {
      existingPlane.updateFrom({ ...existingPlane, ...updates });
    } else {
      Object.assign(updatedPlanes[planeIndex], updates);
    }
    this.updateState({ planes: updatedPlanes, lastUpdate: Date.now() });
    this.planeCache.set(icao, updatedPlanes[planeIndex]);
    this.applyFilters();
  }

  removeOutOfRangePlanes(centerLat: number, centerLon: number, radius: number): PlaneModel[] {
    const currentState = this.stateSubject.value;
    const removedPlanes: PlaneModel[] = [];
    const remainingPlanes = currentState.planes.filter((plane) => {
      if (!plane.lat || !plane.lon) return true;
      if (haversineKm(centerLat, centerLon, plane.lat, plane.lon) > radius) {
        removedPlanes.push(plane);
        this.planeCache.delete(plane.icao);
        return false;
      }
      return true;
    });
    this.updateState({ planes: remainingPlanes, lastUpdate: Date.now() });
    this.applyFilters();
    return removedPlanes;
  }

  getPlane(icao: string): PlaneModel | undefined {
    return this.planeCache.get(icao);
  }

  getActivePlaneIcaos(): Set<string> {
    return new Set(this.stateSubject.value.activePlanes.map((p) => p.icao));
  }

  clearPlanes(): void {
    this.planeCache.clear();
    this.updateState({ planes: [], filteredPlanes: [], activePlanes: [], lastUpdate: Date.now() });
  }

  addToHistory(planes: PlaneModel[]): void {
    const currentState = this.stateSubject.value;
    const existingHistorical = new Map(currentState.historicalPlanes.map((p) => [p.icao, p]));
    planes.forEach((plane) => existingHistorical.set(plane.icao, plane));
    const historicalPlanes = Array.from(existingHistorical.values()).sort((a, b) => b.firstSeen - a.firstSeen);
    this.updateState({ historicalPlanes });
  }

  private async fetchPlanesFromAPI(_lat: number, _lon: number, _radius: number): Promise<PlaneModel[]> {
    return [];
  }

  private processPlaneUpdate(newPlanes: PlaneModel[]): PlaneUpdateResult {
    const currentState = this.stateSubject.value;
    const currentPlaneMap = new Map(currentState.planes.map((p) => [p.icao, p]));
    const newPlaneMap = new Map(newPlanes.map((p) => [p.icao, p]));
    const added: PlaneModel[] = [];
    const updated: PlaneModel[] = [];
    const removed: PlaneModel[] = [];
    newPlanes.forEach((newPlane) => {
      const existing = currentPlaneMap.get(newPlane.icao);
      if (!existing) added.push(newPlane);
      else if (hasPlaneDataChanged(existing, newPlane)) updated.push(newPlane);
      this.planeCache.set(newPlane.icao, newPlane);
    });
    currentState.planes.forEach((currentPlane) => {
      if (!newPlaneMap.has(currentPlane.icao)) {
        removed.push(currentPlane);
        this.planeCache.delete(currentPlane.icao);
      }
    });
    this.updateState({ planes: newPlanes, lastUpdate: Date.now() });
    this.applyFilters();
    return { added, updated, removed, total: newPlanes.length };
  }

  private applyFilters(): void {
    const { filteredPlanes, activePlanes } = filterActivePlanes(
      this.stateSubject.value.planes,
      this.planeFilter,
      this.settings
    );
    this.updateState({ filteredPlanes, activePlanes });
  }

  private updateState(updates: Partial<PlaneDataState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...updates });
  }

  private handleError(error: any): void {
    console.error('PlaneDataOrchestratorService error:', error);
    this.updateState({ error: error.message || 'Unknown error occurred', isLoading: false });
  }
}
