import { Injectable } from '@angular/core';
import { BrightnessService, BrightnessState } from './brightness.service';

@Injectable({
  providedIn: 'root',
})
export class BrightnessDisplayService {
  public brightness: number = 1;
  public brightnessState: BrightnessState | null = null;

  constructor(private brightnessService: BrightnessService) {
    this.subscribeToBrightnessChanges();
  }

  /** Subscribe to brightness service changes and apply them to the map */
  private subscribeToBrightnessChanges(): void {
    this.brightnessService.brightness$.subscribe((brightnessState) => {
      this.brightnessState = brightnessState;
      this.brightness = brightnessState.brightness;
      this.applyBrightnessToMap();
    });
  }

  /** Apply brightness effects to the map container using CSS filters */
  private applyBrightnessToMap(): void {
    if (!this.brightnessState) {
      return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      return;
    }

    const brightness = this.brightnessState.brightness;
    const isDimming = this.brightnessState.isDimming;

    // Create CSS filter based on brightness state
    let filterString = `brightness(${brightness})`;

    // Add additional effects during dimming
    if (isDimming) {
      const contrastValue = 1;
      const saturationValue = 1;
      filterString += ` contrast(${contrastValue}) saturate(${saturationValue})`;
      // Add subtle blue tint during night hours
      if (brightness < 0.3) {
        filterString += ` hue-rotate(10deg)`;
      }
    }

    // Apply the filter to the map container
    mapContainer.style.filter = filterString;
    mapContainer.style.transition = 'filter 0.5s ease-in-out';
  }

  /** Toggle map brightness between normal and dimmed */
  public toggleBrightness(): void {
    this.brightnessService.toggleMode();
  }
}
