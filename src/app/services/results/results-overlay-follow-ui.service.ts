import { Injectable, ChangeDetectorRef } from '@angular/core';
import { FollowCoordinatorService } from '../follow-coordinator/follow-coordinator.service';
import { SettingsService } from '../settings/settings.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayFollowUiService {
  shuffleMode = false;
  nearestMode = false;
  militaryPriority = true;
  private lastToggleTime = 0;
  private readonly debounceMs = 500;

  constructor(
    private followCoordinator: FollowCoordinatorService,
    private settings: SettingsService
  ) {}

  syncModes(shuffle: boolean, nearest: boolean): void {
    this.shuffleMode = shuffle;
    this.nearestMode = nearest;
  }

  toggleCommercialFilter(onChanged: () => void): void {
    const now = Date.now();
    if (now - this.lastToggleTime < this.debounceMs) return;
    this.lastToggleTime = now;
    this.settings.setExcludeDiscount(!this.settings.excludeDiscount);
    onChanged();
  }

  toggleMilitaryMute(): void {
    this.settings.setMilitaryMute(!this.settings.militaryMute);
  }

  toggleShuffle(
    planes: PlaneLogEntry[],
    cdr: ChangeDetectorRef
  ): void {
    const now = Date.now();
    if (now - this.lastToggleTime < this.debounceMs) return;
    this.lastToggleTime = now;
    const next = this.followCoordinator.toggleShuffleMode(planes);
    if (next !== this.shuffleMode) {
      this.shuffleMode = next;
      if (this.shuffleMode) this.nearestMode = false;
    }
    cdr.detectChanges();
  }

  toggleNearest(
    planes: PlaneLogEntry[],
    cdr: ChangeDetectorRef
  ): void {
    const now = Date.now();
    if (now - this.lastToggleTime < this.debounceMs) return;
    this.lastToggleTime = now;
    const next = this.followCoordinator.toggleNearestMode(planes);
    if (next !== this.nearestMode) {
      this.nearestMode = next;
      if (this.nearestMode) this.shuffleMode = false;
    }
    cdr.detectChanges();
  }

  toggleMilitaryPriority(
    planes: PlaneLogEntry[],
    refresh: () => void,
    cdr: ChangeDetectorRef
  ): void {
    this.militaryPriority = !this.militaryPriority;
    const hasMilitary = planes.some((p) => p.isMilitary);
    if (hasMilitary) {
      refresh();
      if (this.shuffleMode) {
        this.followCoordinator.updateAutomaticModes(planes);
      }
    }
    cdr.detectChanges();
  }

  triggerNewShuffle(
    highlightedIcao: string | null,
    planes: PlaneLogEntry[]
  ): void {
    if (highlightedIcao) {
      this.followCoordinator.handlePlaneDisappearance(highlightedIcao, planes);
    } else if (this.shuffleMode) {
      this.followCoordinator.toggleShuffleMode(planes);
      this.followCoordinator.toggleShuffleMode(planes);
    }
  }
}
