import { Injectable, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from '../settings.service';
import { UiStateService } from '../ui-state.service';
import { PlaneDisplayService } from '../plane-display.service';
import { AirportService } from '../airport.service';
import { ScanService } from '../scan.service';
import { BrightnessDisplayService } from '../brightness-display.service';
import { WindService } from '../wind.service';
import { MapRuntimeService } from './map-runtime.service';

@Injectable({ providedIn: 'root' })
export class MapUiControlsService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private runtime: MapRuntimeService,
    private settings: SettingsService,
    private uiState: UiStateService,
    private planeDisplayService: PlaneDisplayService,
    private airportService: AirportService,
    private scanService: ScanService,
    private brightnessDisplay: BrightnessDisplayService,
    private windService: WindService
  ) {}

  onZoomIn(): void {
    this.runtime.map?.zoomIn();
  }

  onZoomOut(): void {
    this.runtime.map?.zoomOut();
  }

  onToggleAirportLabels(): void {
    this.uiState.toggleAirportLabels();
    this.airportService.updateAirportLabels(this.uiState.showAirportLabels);
  }

  onWindowResize(cdr: ChangeDetectorRef): void {
    this.runtime.isResizing = true;
    cdr.detectChanges();
    this.uiState.setShowDateTime(this.settings.getDateTimeOverlayVisibility());
    if (this.runtime.resizeTimeout) {
      clearTimeout(this.runtime.resizeTimeout);
    }
    this.runtime.resizeTimeout = setTimeout(() => {
      this.runtime.isResizing = false;
      cdr.detectChanges();
    }, 500);
  }

  onUpdateNow(): void {
    this.scanService.forceScan();
  }

  onToggleDateTimeOverlays(): void {
    this.uiState.toggleDateTimeOverlay();
  }

  onToggleAltitudeBorders(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiState.setShowAltitudeBorders(enabled);
    this.planeDisplayService.updateTooltipAltitudeBorders(
      Array.from(this.runtime.planeLog.values()),
      enabled
    );
    cdr.detectChanges();
  }

  onToggleAnimations(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiState.setAnimationsEnabled(enabled);
    this.planeDisplayService.applyAnimationSetting(enabled, this.document);
    cdr.detectChanges();
  }

  onToggleWindDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiState.setShowWindDirection(enabled);
    cdr.detectChanges();
  }

  onToggleSunDirection(enabled: boolean, cdr: ChangeDetectorRef): void {
    this.uiState.setShowSunDirection(enabled);
    cdr.detectChanges();
  }

  onWindowViewToggle(show: boolean): void {
    this.uiState.setShowWindowView(show);
  }

  toggleBrightness(): void {
    this.brightnessDisplay.toggleBrightness();
  }

  getWindFromDirection(deg: number): string {
    return this.windService.getWindFromDirection(deg);
  }

  getCurrentWindSpeed(): number {
    return this.windService.getCurrentWindSpeed(this.runtime.windSpeed);
  }

  getCurrentWindUnit(): string {
    return this.windService.getCurrentWindUnit();
  }

  cycleWindUnit(): void {
    this.windService.cycleWindUnit();
  }

  onCenterAirport(coords: { lat: number; lon: number }): void {
    this.runtime.map.panTo([coords.lat, coords.lon], {
      animate: true,
      duration: 1.0,
    });
  }
}
