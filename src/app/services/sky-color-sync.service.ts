import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SkyColors {
  bottomColor: string;
  topColor: string;
  timestamp: number;
}

/**
 * Service to synchronize sky colors between window view and map components
 * Allows the map's cloud layer to use the same atmospheric colors as the window view
 */
@Injectable({
  providedIn: 'root',
})
export class SkyColorSyncService {
  private currentSkyColors = new BehaviorSubject<SkyColors | null>(null);

  /** Observable stream of current sky colors */
  skyColors$ = this.currentSkyColors.asObservable();

  /**
   * Update the current sky colors (called by window view component)
   * @param colors Sky colors calculated by atmospheric service
   */
  updateSkyColors(colors: SkyColors): void {
    this.currentSkyColors.next(colors);
  }

  /**
   * Get the current sky colors synchronously
   * @returns Current sky colors or null if not available
   */
  getCurrentSkyColors(): SkyColors | null {
    return this.currentSkyColors.value;
  }

  /**
   * Clear sky colors (called when window view is hidden or unavailable)
   */
  clearSkyColors(): void {
    this.currentSkyColors.next(null);
  }
}
