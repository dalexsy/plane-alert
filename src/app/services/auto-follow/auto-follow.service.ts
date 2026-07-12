import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, BehaviorSubject } from 'rxjs';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { PlaneFollowService } from '../plane-follow/plane-follow.service';
import { SettingsService } from '../settings/settings.service';
import {
  applyMilitaryPriorityPool,
  getFilteredPlanesForAutoFollow,
  pickNearestPlaneFromPool,
  pickRandomPlaneFromPool,
} from './auto-follow-selection.util';

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
    shuffleIntervalMs: 30000,
    nearestIntervalMs: 5000,
    militaryPriority: true,
    excludeGrounded: true,
    minAltitude: 200,
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

  startShuffle(planeList: PlaneLogEntry[]): void {
    this.stopShuffle();
    this.pickRandomPlane(planeList);
    this.shuffleSubscription = interval(
      this.configSubject.value.shuffleIntervalMs
    ).subscribe(() => {
      this.pickRandomPlane(planeList);
    });
  }

  stopShuffle(): void {
    if (this.shuffleSubscription) {
      this.shuffleSubscription.unsubscribe();
      this.shuffleSubscription = null;
    }
    this.shuffleFollowedIcao = null;
  }

  startNearest(planeList: PlaneLogEntry[]): void {
    this.stopNearest();
    this.pickNearestPlane(planeList);
    this.nearestSubscription = interval(
      this.configSubject.value.nearestIntervalMs
    ).subscribe(() => {
      this.pickNearestPlane(planeList);
    });
  }

  stopNearest(): void {
    if (this.nearestSubscription) {
      this.nearestSubscription.unsubscribe();
      this.nearestSubscription = null;
    }
  }

  get isShuffleActive(): boolean {
    return this.shuffleSubscription !== null;
  }

  get isNearestActive(): boolean {
    return this.nearestSubscription !== null;
  }

  updateConfig(config: Partial<AutoFollowConfig>): void {
    const currentConfig = this.configSubject.value;
    this.configSubject.next({ ...currentConfig, ...config });
  }

  triggerNewShuffle(planeList: PlaneLogEntry[]): void {
    if (this.isShuffleActive) {
      this.pickRandomPlane(planeList);
    }
  }

  private pickRandomPlane(planeList: PlaneLogEntry[]): void {
    const config = this.configSubject.value;
    let pool = getFilteredPlanesForAutoFollow(planeList, config);
    if (pool.length === 0) {
      return;
    }

    pool = applyMilitaryPriorityPool(
      pool,
      config.militaryPriority,
      this.shuffleFollowedIcao
    );

    const selectedPlane = pickRandomPlaneFromPool(pool);
    this.shuffleFollowedIcao = selectedPlane.icao;

    this.planeFollowService.followPlane(
      { ...selectedPlane, followMe: true } as PlaneLogEntry,
      false,
      true,
      false,
      false
    );
  }

  private pickNearestPlane(planeList: PlaneLogEntry[]): void {
    const config = this.configSubject.value;
    let pool = getFilteredPlanesForAutoFollow(planeList, config);
    if (pool.length === 0) {
      return;
    }

    pool = applyMilitaryPriorityPool(pool, config.militaryPriority);

    const nearest = pickNearestPlaneFromPool(
      pool,
      this.settings.lat ?? 0,
      this.settings.lon ?? 0
    );

    this.planeFollowService.followPlane(
      { ...nearest, followMe: true } as PlaneLogEntry,
      false,
      false,
      true,
      false
    );
  }
}
