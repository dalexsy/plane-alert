import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { UiStateService } from '../ui-state/ui-state.service';
import { BrightnessDisplayService } from '../brightness-display/brightness-display.service';
import { WindowViewService } from '../window-view/window-view.service';
import { AirportService } from '../airport/airport.service';
import { PlaneDisplayService } from '../plane-display/plane-display.service';

@Injectable({
  providedIn: 'root',
})
export class EventHandlerService {
  constructor(
    private uiState: UiStateService,
    private brightnessDisplay: BrightnessDisplayService,
    private windowView: WindowViewService,
    private airportService: AirportService,
    private planeDisplay: PlaneDisplayService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  /** Toggle date/time overlay visibility */
  public onToggleDateTimeOverlays(): void {
    this.uiState.toggleDateTimeOverlay();
  }

  /** Toggle display of airport labels tooltips universally */
  public onToggleAirportLabels(): void {
    this.uiState.toggleAirportLabels();
    this.airportService.updateAirportLabels(this.uiState.showAirportLabels);
  }

  /** Toggle altitude-colored borders on plane tooltips */
  public onToggleAltitudeBorders(): void {
    this.uiState.toggleAltitudeBorders();
    // Update all existing tooltips with the new border style
    // Note: This would need access to plane log, so we'll handle this in the component
  }

  /** Toggle animations on/off */
  public onToggleAnimations(): void {
    this.uiState.toggleAnimations();
    // Apply animation setting to document body for CSS animation control
    this.planeDisplay.applyAnimationSetting(
      this.uiState.animationsEnabled,
      this.document
    );
  }

  /** Toggle wind direction display on/off */
  public onToggleWindDirection(): void {
    this.uiState.toggleWindDirection();
  }

  /** Toggle sun direction display on/off */
  public onToggleSunDirection(): void {
    this.uiState.toggleSunDirection();
  }

  /** Toggle window view overlay visibility */
  public onWindowViewToggle(show: boolean): void {
    this.windowView.toggleWindowView(show);
  }

  /** Toggle map brightness between normal and dimmed */
  public onToggleBrightness(): void {
    this.brightnessDisplay.toggleBrightness();
  }

  /** Zoom in the map */
  public onZoomIn(map: any): void {
    if (map) {
      map.zoomIn();
    }
  }

  /** Zoom out the map */
  public onZoomOut(map: any): void {
    if (map) {
      map.zoomOut();
    }
  }

  /** Force scan for planes */
  public onUpdateNow(scanService: any): void {
    scanService.forceScan();
  }
}
