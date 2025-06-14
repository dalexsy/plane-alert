import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import SunCalc from 'suncalc';
import { SettingsService } from './settings.service';

export interface BrightnessState {
  brightness: number;
  isDimming: boolean;
  sunElevation: number;
  isDayTime: boolean;
  mode: 'manual' | 'auto';
}

/**
 * Service for managing adaptive brightness based on sunrise/sunset times
 * Provides gradual dimming that transitions to full darkness in accordance with sun position
 */
@Injectable({
  providedIn: 'root',
})
export class BrightnessService implements OnDestroy {
  private brightnessSubject = new BehaviorSubject<BrightnessState>({
    brightness: 1,
    isDimming: false,
    sunElevation: 0,
    isDayTime: true,
    mode: 'manual',
  });

  public brightness$ = this.brightnessSubject.asObservable();
  private updateInterval: Subscription | null = null;
  private currentLat: number = 52.3667; // Default Berlin coordinates
  private currentLon: number = 13.5033;
  private manualBrightness = 1;

  constructor(private settings: SettingsService) {
    // Load auto-dimming preference from settings
    this.updateBrightness();
    this.emitState();
    
    // Start the update interval when auto dimming is enabled
    this.startUpdateInterval();
  }
  ngOnDestroy(): void {
    this.stopUpdateInterval();
  }

  /**
   * Get auto-dimming enabled state from settings
   */
  private get isAutoDimmingEnabled(): boolean {
    return this.settings.brightnessAutoMode;
  }

  /**
   * Update the observer location for sun calculations
   */
  setLocation(lat: number, lon: number): void {
    this.currentLat = lat;
    this.currentLon = lon;

    if (this.isAutoDimmingEnabled) {
      this.updateBrightness();
    }
  }
  /**
   * Enable automatic brightness dimming based on sunrise/sunset
   */
  enableAutoDimming(): void {
    this.settings.setBrightnessAutoMode(true);
    this.updateBrightness();
    this.emitState();
  }

  /**
   * Disable automatic brightness dimming and return to manual control
   */
  disableAutoDimming(): void {
    this.settings.setBrightnessAutoMode(false);
    this.updateBrightness();
    this.emitState();
  }

  /**
   * Toggle between auto dimming and manual control
   */
  toggleMode(): void {
    if (this.isAutoDimmingEnabled) {
      this.disableAutoDimming();
    } else {
      this.enableAutoDimming();
    }
  }

  /**
   * Set manual brightness (when auto dimming is disabled)
   */
  setManualBrightness(brightness: number): void {
    this.manualBrightness = Math.max(0.1, Math.min(1, brightness));

    if (!this.isAutoDimmingEnabled) {
      this.updateBrightness();
    }
  }

  /**
   * Get current brightness state
   */
  getCurrentState(): BrightnessState {
    return this.brightnessSubject.value;
  }

  /**
   * Calculate brightness based on sun elevation
   */
  private calculateBrightness(): number {
    if (!this.isAutoDimmingEnabled) {
      return this.manualBrightness;
    }

    const now = new Date();
    const sunPos = SunCalc.getPosition(now, this.currentLat, this.currentLon);
    const sunElevationDegrees = (sunPos.altitude * 180) / Math.PI;

    // Calculate brightness based on sun elevation
    // Full brightness during day (sun > 0°)
    // Gradual dimming during twilight phases
    // Minimum brightness during night

    let brightness: number;

    if (sunElevationDegrees > 0) {
      // Daytime - full brightness with slight dimming for low sun
      brightness = Math.max(0.8, 1 - (1 - sunElevationDegrees / 30) * 0.2);
    } else if (sunElevationDegrees > -6) {
      // Civil twilight - moderate dimming
      brightness = 0.4 + ((sunElevationDegrees + 6) / 6) * 0.4; // 0.4 to 0.8
    } else if (sunElevationDegrees > -12) {
      // Nautical twilight - stronger dimming
      brightness = 0.2 + ((sunElevationDegrees + 12) / 6) * 0.2; // 0.2 to 0.4
    } else if (sunElevationDegrees > -18) {
      // Astronomical twilight - heavy dimming
      brightness = 0.1 + ((sunElevationDegrees + 18) / 6) * 0.1; // 0.1 to 0.2
    } else {
      // Night - minimum brightness
      brightness = 0.2;
    }

    return Math.max(0.1, Math.min(1, brightness));
  }

  /**
   * Update brightness calculation and emit new state
   */
  private updateBrightness(): void {
    const now = new Date();
    const sunPos = SunCalc.getPosition(now, this.currentLat, this.currentLon);
    const sunElevationDegrees = (sunPos.altitude * 180) / Math.PI;

    const brightness = this.calculateBrightness();
    const isDayTime = sunElevationDegrees > 0;
    const isDimming = brightness < 0.8;

    this.brightnessSubject.next({
      brightness,
      isDimming,
      sunElevation: sunElevationDegrees,
      isDayTime,
      mode: this.isAutoDimmingEnabled ? 'auto' : 'manual',
    });
  }

  /**
   * Emit current state without recalculating
   */
  private emitState(): void {
    const current = this.brightnessSubject.value;
    this.brightnessSubject.next({
      ...current,
      mode: this.isAutoDimmingEnabled ? 'auto' : 'manual',
    });
  }

  /**
   * Start the periodic update interval
   */
  private startUpdateInterval(): void {
    this.stopUpdateInterval();

    // Update every 30 seconds for smooth transitions
    this.updateInterval = interval(30000).subscribe(() => {
      if (this.isAutoDimmingEnabled) {
        this.updateBrightness();
      }
    });
  }

  /**
   * Stop the periodic update interval
   */
  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      this.updateInterval.unsubscribe();
      this.updateInterval = null;
    }
  }

  /**
   * Get descriptive text for current brightness mode and state
   */
  getStatusText(): string {
    const state = this.getCurrentState();

    if (state.mode === 'manual') {
      return `Manual brightness: ${Math.round(state.brightness * 100)}%`;
    }

    if (state.isDayTime) {
      return `Auto: Daytime (${Math.round(state.brightness * 100)}%)`;
    } else if (state.sunElevation > -6) {
      return `Auto: Civil twilight (${Math.round(state.brightness * 100)}%)`;
    } else if (state.sunElevation > -12) {
      return `Auto: Nautical twilight (${Math.round(state.brightness * 100)}%)`;
    } else if (state.sunElevation > -18) {
      return `Auto: Astronomical twilight (${Math.round(
        state.brightness * 100
      )}%)`;
    } else {
      return `Auto: Night (${Math.round(state.brightness * 100)}%)`;
    }
  }
}
