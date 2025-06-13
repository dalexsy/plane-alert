import { Injectable } from '@angular/core';
import { PlaneFollowService, FollowMode } from './plane-follow.service';
import { AutoFollowService } from './auto-follow.service';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

export interface FollowModeState {
  shuffle: boolean;
  nearest: boolean;
  manual: boolean;
}

/**
 * Coordinates different follow modes and handles conflicts.
 * Ensures only one follow mode is active at a time and manages transitions.
 */
@Injectable({ providedIn: 'root' })
export class FollowCoordinatorService {
  private currentModes: FollowModeState = {
    shuffle: false,
    nearest: false,
    manual: false,
  };

  constructor(
    private planeFollowService: PlaneFollowService,
    private autoFollowService: AutoFollowService
  ) {
    // Subscribe to follow state changes to keep modes in sync
    this.planeFollowService.followState$.subscribe((state) => {
      this.syncModeState(state.mode);
    });
  }
  /**
   * Handle manual plane follow - disables automatic modes, or unfollows if already following the same plane
   */
  followPlaneManually(plane: PlaneLogEntry): void {
    const currentlyFollowedIcao =
      this.planeFollowService.getFollowedPlaneIcao();

    // If clicking the already followed plane, unfollow it
    if (currentlyFollowedIcao === plane.icao && this.currentModes.manual) {
      this.clearAllModes();
      return;
    }

    // Disable any automatic modes
    this.disableAutomaticModes();

    // Set manual mode
    this.currentModes.manual = true;
    this.currentModes.shuffle = false;
    this.currentModes.nearest = false;

    // Follow the plane
    this.planeFollowService.followPlane(
      plane,
      false, // preserve
      false, // fromShuffle
      false, // fromNearest
      true // fromManual
    );
  }

  /**
   * Toggle shuffle mode - disables other modes if enabling
   */
  toggleShuffleMode(planeList: PlaneLogEntry[]): boolean {
    if (this.currentModes.shuffle) {
      // Disable shuffle
      this.autoFollowService.stopShuffle();
      this.currentModes.shuffle = false;
      this.planeFollowService.clearFollow();
      return false;
    } else {
      // Enable shuffle, disable others
      this.disableAllModes();
      this.autoFollowService.startShuffle(planeList);
      this.currentModes.shuffle = true;
      return true;
    }
  }

  /**
   * Toggle nearest mode - disables other modes if enabling
   */
  toggleNearestMode(planeList: PlaneLogEntry[]): boolean {
    if (this.currentModes.nearest) {
      // Disable nearest
      this.autoFollowService.stopNearest();
      this.currentModes.nearest = false;
      this.planeFollowService.clearFollow();
      return false;
    } else {
      // Enable nearest, disable others
      this.disableAllModes();
      this.autoFollowService.startNearest(planeList);
      this.currentModes.nearest = true;
      return true;
    }
  }

  /**
   * Clear all follow modes
   */
  clearAllModes(): void {
    this.disableAllModes();
    this.planeFollowService.clearFollow();
  }

  /**
   * Get current mode states
   */
  getCurrentModes(): FollowModeState {
    return { ...this.currentModes };
  }

  /**
   * Check if any automatic mode is active
   */
  isAnyAutomaticModeActive(): boolean {
    return this.currentModes.shuffle || this.currentModes.nearest;
  }

  /**
   * Update plane lists for active automatic modes
   */
  updateAutomaticModes(planeList: PlaneLogEntry[]): void {
    // This method can be called when plane data updates
    // to ensure automatic modes have current data
    if (this.currentModes.shuffle) {
      // Shuffle mode manages its own intervals, no immediate action needed
    }

    if (this.currentModes.nearest) {
      // Nearest mode manages its own intervals, no immediate action needed
    }
  }

  /**
   * Handle plane disappearance - trigger new selection if needed
   */
  handlePlaneDisappearance(
    planeIcao: string,
    planeList: PlaneLogEntry[]
  ): void {
    const followedIcao = this.planeFollowService.getFollowedPlaneIcao();

    if (followedIcao === planeIcao) {
      if (this.currentModes.shuffle) {
        // Trigger new shuffle
        this.autoFollowService.triggerNewShuffle(planeList);
      } else if (this.currentModes.nearest) {
        // Nearest mode will automatically pick next nearest on next interval
        // Could immediately trigger new selection here if desired
      } else if (this.currentModes.manual) {
        // Clear manual follow
        this.currentModes.manual = false;
        this.planeFollowService.clearFollow();
      }
    }
  }

  /**
   * Disable all automatic follow modes
   */
  private disableAutomaticModes(): void {
    this.autoFollowService.stopShuffle();
    this.autoFollowService.stopNearest();
  }

  /**
   * Disable all follow modes
   */
  private disableAllModes(): void {
    this.disableAutomaticModes();
    this.currentModes.shuffle = false;
    this.currentModes.nearest = false;
    this.currentModes.manual = false;
  }

  /**
   * Sync internal mode state with follow service state
   */
  private syncModeState(mode: FollowMode): void {
    switch (mode) {
      case FollowMode.SHUFFLE:
        this.currentModes.shuffle = true;
        this.currentModes.nearest = false;
        this.currentModes.manual = false;
        break;
      case FollowMode.NEAREST:
        this.currentModes.shuffle = false;
        this.currentModes.nearest = true;
        this.currentModes.manual = false;
        break;
      case FollowMode.MANUAL:
        this.currentModes.shuffle = false;
        this.currentModes.nearest = false;
        this.currentModes.manual = true;
        break;
      case FollowMode.NONE:
        this.currentModes.shuffle = false;
        this.currentModes.nearest = false;
        this.currentModes.manual = false;
        break;
    }
  }
}
