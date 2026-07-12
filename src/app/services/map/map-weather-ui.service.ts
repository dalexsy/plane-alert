import { Injectable, ChangeDetectorRef } from '@angular/core';
import { ViewConeConfig } from '../settings/settings.service';
import { SettingsService } from '../settings/settings.service';
import { UiStateService } from '../ui-state/ui-state.service';
import { WeatherOverlayService } from '../weather-overlay/weather-overlay.service';
import { MapRuntimeService } from './map-runtime.service';

@Injectable({ providedIn: 'root' })
export class MapWeatherUiService {
  constructor(
    private runtime: MapRuntimeService,
    private settings: SettingsService,
    private uiState: UiStateService,
    private weatherOverlayService: WeatherOverlayService
  ) {}

  toggleConeVisibility(show: boolean, cdr: ChangeDetectorRef): void {
    this.uiState.setConeVisibility(show);
    this.settings.setShowViewAxes(show);
    cdr.detectChanges();
  }

  onConeConfigChange(cones: ViewConeConfig[], cdr: ChangeDetectorRef): void {
    this.settings.setViewConesConfig(cones);
    this.runtime.viewConesConfig = [...cones];
    cdr.detectChanges();
  }

  onConeConfig(): void {
    this.runtime.showConeConfigEditor = !this.runtime.showConeConfigEditor;
  }

  setCloudOpacity(opacity: number): void {
    this.runtime.cloudOpacity = opacity;
    if (this.runtime.cloudLayer) {
      this.runtime.cloudLayer.setOpacity(opacity);
    }
  }

  setRainOpacity(opacity: number): void {
    this.runtime.rainOpacity = opacity;
    if (this.runtime.rainLayer) {
      this.runtime.rainLayer.setOpacity(opacity);
    }
  }

  toggleCloudCover(show: boolean): void {
    this.uiState.setCloudVisible(show);
    this.weatherOverlayService.setCloudCoverVisible(show);
  }

  toggleRainCover(show: boolean): void {
    this.uiState.setRainVisible(show);
    this.weatherOverlayService.setRainCoverVisible(show);
  }
}
