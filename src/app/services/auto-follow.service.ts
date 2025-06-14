import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, BehaviorSubject } from 'rxjs';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';
import { PlaneFollowService, FollowMode } from './plane-follow.service';
import { SettingsService } from './settings.service';
import { haversineDistance } from '../utils/geo-utils';

export interface AutoFollowConfig {
  shuffleIntervalMs: number;
  nearestIntervalMs: number;
  militaryPriority: boolean;
  excludeGrounded: boolean;
  minAltitude: number;
}

@Injectable({ providedIn: 'root' })
export class AutoFollowService implements OnDestroy {
  private shuffleSubscription: Subscription | null = null;
  private nearestSubscription: Subscription | null = null;
  private shuffleFollowedIcao: string | null = null;

  private configSubject = new BehaviorSubject<AutoFollowConfig>({
    shuffleIntervalMs: 30000, // 30 seconds
    nearestIntervalMs: 5000, // 5 seconds
    militaryPriority: true,
    excludeGrounded: true,
    minAltitude: 200, // meters
  });

  config$ = this.configSubject.asObservable();

  constructor(
    private planeFollowService: PlaneFollowService,
    private settings: SettingsService
  ) {}

  ngOnDestroy(): void {
    this.stopShuffle();
    this.stopNearest();
  }

  /** Start shuffle mode - picks random plane every interval */
  startShuffle(planeList: PlaneLogEntry[]): void {
    this.stopShuffle();

    // Pick immediately
    this.pickRandomPlane(planeList);

    // Then every interval
    this.shuffleSubscription = interval(
      this.configSubject.value.shuffleIntervalMs
    ).subscribe(() => {
      this.pickRandomPlane(planeList);
    });
  }

  /** Stop shuffle mode */
  stopShuffle(): void {
    if (this.shuffleSubscription) {
      this.shuffleSubscription.unsubscribe();
      this.shuffleSubscription = null;
    }
    this.shuffleFollowedIcao = null;
  }

  /** Start nearest mode - picks nearest plane every interval */
  startNearest(planeList: PlaneLogEntry[]): void {
    this.stopNearest();

    // Pick immediately
    this.pickNearestPlane(planeList);

    // Then every interval
    this.nearestSubscription = interval(
      this.configSubject.value.nearestIntervalMs
    ).subscribe(() => {
      this.pickNearestPlane(planeList);
    });
  }

  /** Stop nearest mode */
  stopNearest(): void {
    if (this.nearestSubscription) {
      this.nearestSubscription.unsubscribe();
      this.nearestSubscription = null;
    }
  }

  /** Check if shuffle mode is active */
  get isShuffleActive(): boolean {
    return this.shuffleSubscription !== null;
  }

  /** Check if nearest mode is active */
  get isNearestActive(): boolean {
    return this.nearestSubscription !== null;
  }

  /** Update configuration */
  updateConfig(config: Partial<AutoFollowConfig>): void {
    const currentConfig = this.configSubject.value;
    this.configSubject.next({ ...currentConfig, ...config });
  }

  /** Pick a random plane from the filtered list */
  private pickRandomPlane(planeList: PlaneLogEntry[]): void {
    const config = this.configSubject.value;
    let pool = this.getFilteredPlanes(planeList, config);

    if (pool.length === 0) {
      return;
    }

    // If military priority enabled, try military/special first
    if (config.militaryPriority) {
      const priority = pool.filter((p) => p.isMilitary || p.isSpecial);

      if (priority.length > 1 && this.shuffleFollowedIcao) {
        // Exclude currently followed plane for variety
        const filtered = priority.filter(
          (p) => p.icao !== this.shuffleFollowedIcao
        );
        pool = filtered.length > 0 ? filtered : priority;
      } else if (priority.length > 0) {
        pool = priority;
      }
    }

    // Pick random plane
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedPlane = pool[randomIndex];

    this.shuffleFollowedIcao = selectedPlane.icao;

    // Create a plane with follow metadata
    const planeToFollow = { ...selectedPlane, followMe: true };

    this.planeFollowService.followPlane(
      planeToFollow,
      false,
      true, // fromShuffle
      false,
      false
    );
  }
  /** Pick the nearest plane from the filtered list */
  private pickNearestPlane(planeList: PlaneLogEntry[]): void {
    const config = this.configSubject.value;
    let pool = this.getFilteredPlanes(planeList, config);

    if (pool.length === 0) {
      return;
    }

    // If military priority enabled, try military/special first
    if (config.militaryPriority) {
      const priority = pool.filter((p) => p.isMilitary || p.isSpecial);
      if (priority.length > 0) {
        pool = priority;
      }
    }

    const centerLat = this.settings.lat ?? 0;
    const centerLon = this.settings.lon ?? 0;

    // Find nearest by haversine distance
    const nearest = pool.reduce((prev, curr) => {
      const prevDist = haversineDistance(
        centerLat,
        centerLon,
        prev.lat!,
        prev.lon!
      );
      const currDist = haversineDistance(
        centerLat,
        centerLon,
        curr.lat!,
        curr.lon!
      );
      return currDist < prevDist ? curr : prev;
    });

    // Create a plane with follow metadata
    const planeToFollow = { ...nearest, followMe: true };

    this.planeFollowService.followPlane(
      planeToFollow,
      false,
      false,
      true, // fromNearest
      false
    );
  }
  /** Get filtered plane list based on configuration */
  private getFilteredPlanes(
    planeList: PlaneLogEntry[],
    config: AutoFollowConfig
  ): PlaneLogEntry[] {
    return planeList.filter((plane) => {
      // Must have valid coordinates
      if (plane.lat == null || plane.lon == null) {
        return false;
      }

      // Must not be filtered out
      if (plane.filteredOut) {
        return false;
      }

      // Exclude unknown objects
      if (plane.isUnknown) {
        return false;
      }

      // Exclude grounded planes if configured
      if (config.excludeGrounded && plane.onGround) {
        return false;
      }

      // Check minimum altitude
      if (plane.altitude != null && plane.altitude < config.minAltitude) {
        return false;
      }

      return true;
    });
  }

  /** Trigger new shuffle if currently shuffling (called when followed plane disappears) */
  triggerNewShuffle(planeList: PlaneLogEntry[]): void {
    if (this.isShuffleActive) {
      this.pickRandomPlane(planeList);
    }
  }
}
