import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

export interface FollowRequest {
  plane: WindowViewPlane | PlaneLogEntry;
  preserve?: boolean;
  fromShuffle?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlaneFollowService {
  private followSubject = new Subject<FollowRequest>();
  /** Observable for follow requests */
  follow$ = this.followSubject.asObservable();

  /** Trigger centering/following of a plane */
  followPlane(
    plane: WindowViewPlane | PlaneLogEntry,
    preserve: boolean = false,
    fromShuffle: boolean = false
  ): void {
    this.followSubject.next({ plane, preserve, fromShuffle });
  }
}
