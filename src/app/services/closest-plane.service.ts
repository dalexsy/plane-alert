import { Injectable } from '@angular/core';
import { PlaneModel } from '../models/plane-model';
import { SettingsService } from './settings.service';
import { GeocodingCacheService } from './geocoding-cache.service';
import { haversineDistance } from '../utils/geo-utils';

@Injectable({
  providedIn: 'root',
})
export class ClosestPlaneService {
  // Closest plane overlay properties
  closestPlane: PlaneModel | null = null;
  closestDistance: number | null = null;
  closestOperator: string | null = null;
  closestSecondsAway: number | null = null;
  closestVelocity: number | null = null;

  // Location overlay properties for closest plane
  locationStreet: string | null = null;
  locationDistrict: string | null = null;

  // Track last geocoded position to avoid redundant API calls
  private lastGeocodedLat: number | null = null;
  private lastGeocodedLon: number | null = null;
  private readonly GEOCODE_PRECISION = 3; // Only geocode if position changes by ~100m

  constructor(
    private settings: SettingsService,
    private geocodingCache: GeocodingCacheService
  ) {}

  /**
   * Compute and update the closest plane based on current plane log and settings
   */
  computeClosestPlane(
    planeLog: Map<string, PlaneModel>,
    highlightedPlaneIcao: string | null
  ): void {
    const centerLat = this.settings.lat ?? 52.3667;
    const centerLon = this.settings.lon ?? 13.5033;

    // Use PlaneModel entries from planeLog
    let candidate: PlaneModel | undefined;

    // Show followed plane in overlay regardless of follow mode (manual, shuffle, or nearest)
    if (highlightedPlaneIcao) {
      candidate = planeLog.get(highlightedPlaneIcao) || undefined;
    }

    if (!candidate) {
      let minDist = Infinity;
      for (const plane of planeLog.values()) {
        // Exclude filtered, unpositioned, or unknown devices
        if (
          plane.filteredOut ||
          plane.lat == null ||
          plane.lon == null ||
          plane.isUnknown
        )
          continue;
        const d = haversineDistance(centerLat, centerLon, plane.lat, plane.lon);
        if (d < minDist) {
          minDist = d;
          candidate = plane;
        }
      }
    }

    if (!candidate) {
      this.closestPlane = null;
      this.closestDistance = null;
      this.closestOperator = null;
      this.closestSecondsAway = null;
      this.closestVelocity = null;
      return;
    }

    // Update overlay with selected candidate
    this.closestPlane = candidate;
    const dist = haversineDistance(
      centerLat,
      centerLon,
      candidate.lat!,
      candidate.lon!
    );
    this.closestDistance = Math.round(dist * 10) / 10;

    this.closestOperator = candidate.operator || null;

    // Only show ETA if velocity >= 200
    const vel = candidate.velocity ?? null;
    if (vel != null && vel >= 200) {
      this.closestVelocity = vel;
      this.closestSecondsAway = Math.round((dist * 1000) / vel);
    } else {
      this.closestVelocity = null;
      this.closestSecondsAway = null;
    }

    // Always update location information for the closest plane,
    // even if we're not following it yet
    if (candidate && candidate.lat !== null && candidate.lon !== null) {
      this.updateClosestPlaneLocation(candidate.lat, candidate.lon);
    }
  }

  /**
   * Update location information for the closest plane
   */
  private updateClosestPlaneLocation(lat: number, lon: number): void {
    // Only geocode if position has meaningfully changed
    const roundedLat = Number(lat.toFixed(this.GEOCODE_PRECISION));
    const roundedLon = Number(lon.toFixed(this.GEOCODE_PRECISION));

    if (
      this.lastGeocodedLat === roundedLat &&
      this.lastGeocodedLon === roundedLon
    ) {
      return; // Skip geocoding - position hasn't changed enough
    }

    this.lastGeocodedLat = roundedLat;
    this.lastGeocodedLon = roundedLon;

    this.geocodingCache.reverseGeocode(lat, lon).then((address) => {
      this.locationStreet = address;
      this.locationDistrict = address;
    });
  }

  /**
   * Get the current closest plane data
   */
  getClosestPlaneData() {
    return {
      closestPlane: this.closestPlane,
      closestDistance: this.closestDistance,
      closestOperator: this.closestOperator,
      closestSecondsAway: this.closestSecondsAway,
      closestVelocity: this.closestVelocity,
      locationStreet: this.locationStreet,
      locationDistrict: this.locationDistrict,
    };
  }

  /**
   * Clear closest plane data
   */
  clearClosestPlane(): void {
    this.closestPlane = null;
    this.closestDistance = null;
    this.closestOperator = null;
    this.closestSecondsAway = null;
    this.closestVelocity = null;
    this.locationStreet = null;
    this.locationDistrict = null;
  }
}
