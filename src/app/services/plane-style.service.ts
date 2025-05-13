import { Injectable } from '@angular/core';
import { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';

@Injectable({ providedIn: 'root' })
export class PlaneStyleService {
  /**
   * Determine the color for plane labels based on plane status and followed state.
   * @param plane The plane object (WindowViewPlane or PlaneLogEntry)
   * @param isFollowed Whether this plane is currently followed/highlighted
   */
  getLabelColor(
    plane: { isMarker?: boolean; isCelestial?: boolean; isNew?: boolean; isMilitary?: boolean; isSpecial?: boolean },
    isFollowed: boolean = false
  ): string {
    if (plane.isMarker) {
      return ''; // markers use vertical-line color, not label
    }
    if (plane.isCelestial) {
      return ''; // celestial use default or own styling
    }
    // Followed plane overrides most other states except military
    if (isFollowed) {
      if (plane.isMilitary) {
        return '#89d138';
      }
      return '#00ffff'; // followed-plane-color
    }
    // New plane state
    if (plane.isNew) {
      return '#ff6161'; // new-plane-color
    }
    // Military
    if (plane.isMilitary) {
      return '#89d138';
    }
    // Special
    if (plane.isSpecial) {
      return 'gold';
    }
    // Default color
    return '#fff';
  }
}