import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { WeatherOverlayService } from '../weather-overlay/weather-overlay.service';
import { effectiveAnimationsEnabled } from '../../utils/kiosk-mode/kiosk-mode.util';

@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  // UI overlay toggles
  public showDateTime = true;
  public showAirportLabels = false;
  public showAltitudeBorders = false;
  public showWindDirection = true;
  public showSunDirection = true;
  public animationsEnabled = true;
  /** Onion-skin: fixed ghost at last reported ADS-B position while icon animates. */
  public showGhostPosition = true;
  public showWindowView = true;

  // Weather layer toggles
  public coneVisible = false;
  public cloudVisible = true;
  public rainVisible = true;

  constructor(
    private settings: SettingsService,
    private weatherOverlayService: WeatherOverlayService
  ) {
    this.initializeFromSettings();
  }

  private initializeFromSettings(): void {
    this.showDateTime = this.settings.getDateTimeOverlayVisibility();
    this.showAirportLabels = this.settings.showAirportLabels;
    this.showAltitudeBorders = this.settings.showAltitudeBorders;
    this.showWindDirection = this.settings.showWindDirection;
    this.showSunDirection = this.settings.showSunDirection;
    this.animationsEnabled = effectiveAnimationsEnabled(this.settings.animationsEnabled);
    this.showGhostPosition = this.settings.showGhostPosition;
    this.showWindowView = this.settings.showWindowView;
    this.coneVisible = this.settings.showViewAxes;
    this.cloudVisible = this.settings.showCloudCover;
    this.rainVisible = this.settings.showRainCover;
  }

  // Date/Time overlay toggle
  public toggleDateTimeOverlay(): void {
    this.showDateTime = !this.showDateTime;
    // Save the setting based on device type
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      this.settings.setShowDateTimeOverlayMobile(this.showDateTime);
    } else {
      this.settings.setShowDateTimeOverlay(this.showDateTime);
    }
  }

  // Airport labels toggle
  public toggleAirportLabels(): void {
    this.showAirportLabels = !this.showAirportLabels;
    this.settings.setShowAirportLabels(this.showAirportLabels);
  }

  // Altitude borders toggle
  public toggleAltitudeBorders(): void {
    this.showAltitudeBorders = !this.showAltitudeBorders;
    this.settings.setShowAltitudeBorders(this.showAltitudeBorders);
  }

  // Wind direction toggle
  public toggleWindDirection(): void {
    this.showWindDirection = !this.showWindDirection;
    this.settings.setShowWindDirection(this.showWindDirection);
  }

  // Sun direction toggle
  public toggleSunDirection(): void {
    this.showSunDirection = !this.showSunDirection;
    this.settings.setShowSunDirection(this.showSunDirection);
  }

  // Animations toggle
  public toggleAnimations(): void {
    this.animationsEnabled = !this.animationsEnabled;
    this.settings.setAnimationsEnabled(this.animationsEnabled);
  }

  // Ghost position (onion skin) toggle — only meaningful when animations are on
  public toggleGhostPosition(): void {
    this.showGhostPosition = !this.showGhostPosition;
    this.settings.setShowGhostPosition(this.showGhostPosition);
  }

  public setShowGhostPosition(enabled: boolean): void {
    this.showGhostPosition = enabled;
    this.settings.setShowGhostPosition(enabled);
  }

  // Window view toggle
  public toggleWindowView(): void {
    this.showWindowView = !this.showWindowView;
    this.settings.setShowWindowView(this.showWindowView);
  }

  // Cone visibility toggle
  public toggleConeVisibility(): void {
    this.coneVisible = !this.coneVisible;
    this.settings.setShowViewAxes(this.coneVisible);
  }

  // Cloud layer toggle
  public toggleCloudCover(): void {
    this.cloudVisible = !this.cloudVisible;
    this.settings.setShowCloudCover(this.cloudVisible);
    this.weatherOverlayService.setCloudCoverVisible(this.cloudVisible);
  }

  // Rain layer toggle
  public toggleRainCover(): void {
    this.rainVisible = !this.rainVisible;
    this.settings.setShowRainCover(this.rainVisible);
    this.weatherOverlayService.setRainCoverVisible(this.rainVisible);
  }

  // Set cone visibility directly (for programmatic control)
  public setConeVisibility(visible: boolean): void {
    this.coneVisible = visible;
    this.settings.setShowViewAxes(visible);
  }

  // Set date/time overlay visibility directly (for programmatic control)
  public setShowDateTime(visible: boolean): void {
    this.showDateTime = visible;
    // Save the setting based on device type
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      this.settings.setShowDateTimeOverlayMobile(visible);
    } else {
      this.settings.setShowDateTimeOverlay(visible);
    }
  }

  // Set altitude borders directly (for programmatic control)
  public setShowAltitudeBorders(enabled: boolean): void {
    this.showAltitudeBorders = enabled;
    this.settings.setShowAltitudeBorders(enabled);
  }

  // Set animations directly (for programmatic control)
  public setAnimationsEnabled(enabled: boolean): void {
    const next = effectiveAnimationsEnabled(enabled);
    this.animationsEnabled = next;
    this.settings.setAnimationsEnabled(next);
  }

  // Set wind direction directly (for programmatic control)
  public setShowWindDirection(enabled: boolean): void {
    this.showWindDirection = enabled;
    this.settings.setShowWindDirection(enabled);
  }

  // Set sun direction directly (for programmatic control)
  public setShowSunDirection(enabled: boolean): void {
    this.showSunDirection = enabled;
    this.settings.setShowSunDirection(enabled);
  }

  // Set cloud visibility directly (for programmatic control)
  public setCloudVisible(visible: boolean): void {
    this.cloudVisible = visible;
    this.settings.setShowCloudCover(visible);
    this.weatherOverlayService.setCloudCoverVisible(visible);
  }

  // Set rain visibility directly (for programmatic control)
  public setRainVisible(visible: boolean): void {
    this.rainVisible = visible;
    this.settings.setShowRainCover(visible);
    this.weatherOverlayService.setRainCoverVisible(visible);
  }

  // Set window view directly (for programmatic control)
  public setShowWindowView(enabled: boolean): void {
    this.showWindowView = enabled;
    this.settings.setShowWindowView(enabled);
  }
}
