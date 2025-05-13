import { Injectable } from '@angular/core';
import { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';

@Injectable({ providedIn: 'root' })
export class PlaneStyleService {
  /**
   * Determine the color for plane labels based on plane status.
   */
  getLabelColor(plane: WindowViewPlane): string {
    if (plane.isMarker) {
      return ''; // markers use vertical-line color, not label
    }
    if (plane.isCelestial) {
      return ''; // celestial use default or own styling
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
    // Dimmed due to distance, reduce opacity instead of color
    // Default color
    return '#fff';
  }
}