/**
 * Plane Data Orchestrator Service
 * Coordinates plane discovery, filtering, and visual updates
 */

import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  distinctUntilChanged,
} from 'rxjs';
import { PlaneModel } from '../models/plane-model';
import { PlaneFinderService } from './plane-finder.service';
import { PlaneFilterService } from './plane-filter.service';
import { SettingsService } from './settings.service';

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

@Injectable({
  providedIn: 'root',
})
export class PlaneDataOrchestratorService {
  private stateSubject = new BehaviorSubject<PlaneDataState>({
    planes: [],
    filteredPlanes: [],
    activePlanes: [],
    historicalPlanes: [],
    isLoading: false,
    lastUpdate: 0,
  });

  public state$ = this.stateSubject.asObservable();

  // Derived observables for specific data
  public activePlanes$ = this.state$.pipe(
    map((state) => state.activePlanes),
    distinctUntilChanged()
  );

  public filteredPlanes$ = this.state$.pipe(
    map((state) => state.filteredPlanes),
    distinctUntilChanged()
  );

  public isLoading$ = this.state$.pipe(
    map((state) => state.isLoading),
    distinctUntilChanged()
  );

  private planeCache = new Map<string, PlaneModel>();
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(
    private planeFinder: PlaneFinderService,
    private planeFilter: PlaneFilterService,
    private settings: SettingsService
  ) {
    this.setupFilterSubscription();
  }

  /**
   * Refresh plane data for the given location and radius
   */
  async refreshPlanes(
    lat: number,
    lon: number,
    radius: number
  ): Promise<PlaneUpdateResult> {
    this.updateLoadingState(true);

    try {
      const currentTime = Date.now();

      // Use cache if data is fresh
      if (currentTime - this.lastFetchTime < this.CACHE_DURATION) {
        const cachedPlanes = Array.from(this.planeCache.values());
        const result = this.processPlaneUpdate(cachedPlanes);
        this.updateLoadingState(false);
        return result;
      }

      // Fetch new data
      const planes = await this.fetchPlanesFromAPI(lat, lon, radius);
      const result = this.processPlaneUpdate(planes);

      this.lastFetchTime = currentTime;
      this.updateLoadingState(false);

      return result;
    } catch (error) {
      this.handleError(error);
      this.updateLoadingState(false);
      throw error;
    }
  }

  /**
   * Update a single plane's data
   */
  updatePlane(icao: string, updates: Partial<PlaneModel>): void {
    const currentState = this.stateSubject.value;
    const planeIndex = currentState.planes.findIndex((p) => p.icao === icao);

    if (planeIndex === -1) return;

    const updatedPlanes = [...currentState.planes];
    // Apply updates to planes using PlaneModel's updateFrom method
    const existingPlane = updatedPlanes[planeIndex];
    if (existingPlane && typeof existingPlane.updateFrom === 'function') {
      existingPlane.updateFrom({ ...existingPlane, ...updates });
    } else {
      // Fallback for plain objects - convert to proper PlaneModel structure
      Object.assign(updatedPlanes[planeIndex], updates);
    }

    this.updateState({
      planes: updatedPlanes,
      lastUpdate: Date.now(),
    });

    // Update cache
    this.planeCache.set(icao, updatedPlanes[planeIndex]);

    // Reapply filters
    this.applyFilters();
  }

  /**
   * Remove planes that are out of range
   */
  removeOutOfRangePlanes(
    centerLat: number,
    centerLon: number,
    radius: number
  ): PlaneModel[] {
    const currentState = this.stateSubject.value;
    const removedPlanes: PlaneModel[] = [];

    const remainingPlanes = currentState.planes.filter((plane) => {
      if (!plane.lat || !plane.lon) return true;

      const distance = this.calculateDistance(
        centerLat,
        centerLon,
        plane.lat,
        plane.lon
      );

      if (distance > radius) {
        removedPlanes.push(plane);
        this.planeCache.delete(plane.icao);
        return false;
      }

      return true;
    });

    this.updateState({
      planes: remainingPlanes,
      lastUpdate: Date.now(),
    });

    this.applyFilters();
    return removedPlanes;
  }

  /**
   * Get plane by ICAO code
   */
  getPlane(icao: string): PlaneModel | undefined {
    return this.planeCache.get(icao);
  }

  /**
   * Get all active plane ICAOs
   */
  getActivePlaneIcaos(): Set<string> {
    const state = this.stateSubject.value;
    return new Set(state.activePlanes.map((p) => p.icao));
  }

  /**
   * Clear all plane data
   */
  clearPlanes(): void {
    this.planeCache.clear();
    this.updateState({
      planes: [],
      filteredPlanes: [],
      activePlanes: [],
      lastUpdate: Date.now(),
    });
  }

  /**
   * Add planes to historical log
   */
  addToHistory(planes: PlaneModel[]): void {
    const currentState = this.stateSubject.value;
    const existingHistorical = new Map(
      currentState.historicalPlanes.map((p) => [p.icao, p])
    );

    // Merge with existing historical data
    planes.forEach((plane) => {
      existingHistorical.set(plane.icao, plane);
    });

    // Sort by recency (most recent first)
    const historicalPlanes = Array.from(existingHistorical.values()).sort(
      (a, b) => b.firstSeen - a.firstSeen
    );

    this.updateState({ historicalPlanes });
  }
  /**
   * Setup subscription to filter changes
   */
  private setupFilterSubscription(): void {
    // Subscribe to settings changes directly since PlaneFilterService doesn't expose filtersChanged$
    this.settings.excludeDiscountChanged.subscribe(() => {
      this.applyFilters();
    });
  }
  /**
   * Fetch planes from the API
   */
  private async fetchPlanesFromAPI(
    lat: number,
    lon: number,
    radius: number
  ): Promise<PlaneModel[]> {
    // This would use the existing PlaneFinderService
    // For now, return empty array - actual implementation would integrate with existing services
    return [];
  }

  /**
   * Process plane update and determine changes
   */
  private processPlaneUpdate(newPlanes: PlaneModel[]): PlaneUpdateResult {
    const currentState = this.stateSubject.value;
    const currentPlaneMap = new Map(
      currentState.planes.map((p) => [p.icao, p])
    );
    const newPlaneMap = new Map(newPlanes.map((p) => [p.icao, p]));

    const added: PlaneModel[] = [];
    const updated: PlaneModel[] = [];
    const removed: PlaneModel[] = [];

    // Find added and updated planes
    newPlanes.forEach((newPlane) => {
      const existing = currentPlaneMap.get(newPlane.icao);
      if (!existing) {
        added.push(newPlane);
      } else if (this.hasPlaneChanged(existing, newPlane)) {
        updated.push(newPlane);
      }

      // Update cache
      this.planeCache.set(newPlane.icao, newPlane);
    });

    // Find removed planes
    currentState.planes.forEach((currentPlane) => {
      if (!newPlaneMap.has(currentPlane.icao)) {
        removed.push(currentPlane);
        this.planeCache.delete(currentPlane.icao);
      }
    });

    // Update state
    this.updateState({
      planes: newPlanes,
      lastUpdate: Date.now(),
    });

    // Apply filters to new data
    this.applyFilters();

    return {
      added,
      updated,
      removed,
      total: newPlanes.length,
    };
  }

  /**
   * Apply current filters to plane data
   */
  private applyFilters(): void {
    const currentState = this.stateSubject.value;

    const filteredPlanes = currentState.planes.filter((plane) => {
      return this.planeFilter.shouldIncludeCallsign(
        plane.callsign,
        this.settings.excludeDiscount,
        this.planeFilter.getFilterPrefixes(),
        plane.isMilitary || false
      );
    });

    const activePlanes = filteredPlanes.filter(
      (plane) => !plane.filteredOut && plane.lat != null && plane.lon != null
    );

    this.updateState({
      filteredPlanes,
      activePlanes,
    });
  }

  /**
   * Check if plane data has changed significantly
   */
  private hasPlaneChanged(existing: PlaneModel, updated: PlaneModel): boolean {
    return (
      existing.lat !== updated.lat ||
      existing.lon !== updated.lon ||
      existing.altitude !== updated.altitude ||
      existing.track !== updated.track ||
      existing.velocity !== updated.velocity ||
      existing.onGround !== updated.onGround
    );
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Update the state immutably
   */
  private updateState(updates: Partial<PlaneDataState>): void {
    const currentState = this.stateSubject.value;
    const newState = { ...currentState, ...updates };
    this.stateSubject.next(newState);
  }

  /**
   * Update loading state
   */
  private updateLoadingState(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    console.error('PlaneDataOrchestratorService error:', error);
    this.updateState({
      error: error.message || 'Unknown error occurred',
      isLoading: false,
    });
  }
}
