import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

export interface FollowRequest {
  plane: WindowViewPlane | PlaneLogEntry;
  preserve?: boolean;
  fromShuffle?: boolean;
  fromNearest?: boolean;
  fromManual?: boolean;
}

export enum FollowMode {
  NONE = 'none',
  MANUAL = 'manual',
  SHUFFLE = 'shuffle',
  NEAREST = 'nearest',
}

export interface FollowState {
  mode: FollowMode;
  followedPlaneIcao: string | null;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlaneFollowService {
  private followSubject = new Subject<FollowRequest>();
  private followStateSubject = new BehaviorSubject<FollowState>({
    mode: FollowMode.NONE,
    followedPlaneIcao: null,
    isActive: false,
  });

  /** Observable for follow requests */
  follow$ = this.followSubject.asObservable();

  /** Observable for follow state changes */
  followState$ = this.followStateSubject.asObservable();

  /** Get current follow state */
  get currentState(): FollowState {
    return this.followStateSubject.value;
  }

  /** Trigger centering/following of a plane */
  followPlane(
    plane: WindowViewPlane | PlaneLogEntry,
    preserve: boolean = false,
    fromShuffle: boolean = false,
    fromNearest: boolean = false,
    fromManual: boolean = false
  ): void {
    const request: FollowRequest = {
      plane,
      preserve,
      fromShuffle,
      fromNearest,
      fromManual,
    };

    this.followSubject.next(request);
    this.updateFollowState(plane.icao, fromShuffle, fromNearest, fromManual);
  }

  /** Update follow state based on the source of the follow request */
  private updateFollowState(
    planeIcao: string,
    fromShuffle: boolean,
    fromNearest: boolean,
    fromManual: boolean
  ): void {
    let mode: FollowMode = FollowMode.NONE;

    if (fromShuffle) {
      mode = FollowMode.SHUFFLE;
    } else if (fromNearest) {
      mode = FollowMode.NEAREST;
    } else if (fromManual) {
      mode = FollowMode.MANUAL;
    }

    this.followStateSubject.next({
      mode,
      followedPlaneIcao: planeIcao,
      isActive: true,
    });
  }

  /** Clear follow state */
  clearFollow(): void {
    this.followStateSubject.next({
      mode: FollowMode.NONE,
      followedPlaneIcao: null,
      isActive: false,
    });
  }

  /** Check if a specific mode is active */
  isModeActive(mode: FollowMode): boolean {
    return this.currentState.mode === mode && this.currentState.isActive;
  }

  /** Get the currently followed plane ICAO */
  getFollowedPlaneIcao(): string | null {
    return this.currentState.followedPlaneIcao;
  }
}
