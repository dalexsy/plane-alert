import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import SunCalc from 'suncalc';
import { SettingsService } from '../settings/settings.service';
import {
  BRIGHTNESS_LEVELS,
  buildBrightnessStatusText,
  calculateAutoBrightness,
} from './brightness-calc.util';

export interface BrightnessState {
  brightness: number;
  isDimming: boolean;
  sunElevation: number;
  isDayTime: boolean;
  mode: 'manual' | 'auto';
}

@Injectable({ providedIn: 'root' })
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
  private currentLat = 52.3667;
  private currentLon = 13.5033;
  private manualBrightness = 1;

  constructor(private settings: SettingsService) {
    this.updateBrightness();
    this.emitState();
    this.startUpdateInterval();
  }

  ngOnDestroy(): void {
    this.stopUpdateInterval();
  }

  private get isAutoDimmingEnabled(): boolean {
    return this.settings.brightnessAutoMode;
  }

  setLocation(lat: number, lon: number): void {
    this.currentLat = lat;
    this.currentLon = lon;
    if (this.isAutoDimmingEnabled) {
      this.updateBrightness();
    }
  }

  enableAutoDimming(): void {
    this.settings.setBrightnessAutoMode(true);
    this.updateBrightness();
    this.emitState();
  }

  disableAutoDimming(): void {
    this.settings.setBrightnessAutoMode(false);
    this.updateBrightness();
    this.emitState();
  }

  toggleMode(): void {
    if (this.isAutoDimmingEnabled) {
      this.disableAutoDimming();
    } else {
      this.enableAutoDimming();
    }
  }

  setManualBrightness(brightness: number): void {
    this.manualBrightness = Math.max(
      BRIGHTNESS_LEVELS.ABSOLUTE_MIN,
      Math.min(BRIGHTNESS_LEVELS.ABSOLUTE_MAX, brightness),
    );
    if (!this.isAutoDimmingEnabled) {
      this.updateBrightness();
    }
  }

  getCurrentState(): BrightnessState {
    return this.brightnessSubject.value;
  }

  getStatusText(): string {
    return buildBrightnessStatusText(this.getCurrentState());
  }

  getBrightnessLevels() {
    return { ...BRIGHTNESS_LEVELS };
  }

  private calculateBrightness(): number {
    return calculateAutoBrightness(
      this.currentLat,
      this.currentLon,
      this.manualBrightness,
      this.isAutoDimmingEnabled,
    );
  }

  private updateBrightness(): void {
    const now = new Date();
    const sunPos = SunCalc.getPosition(now, this.currentLat, this.currentLon);
    const sunElevationDegrees = (sunPos.altitude * 180) / Math.PI;
    const brightness = this.calculateBrightness();
    const next: BrightnessState = {
      brightness,
      isDimming: brightness < 0.8,
      sunElevation: sunElevationDegrees,
      isDayTime: sunElevationDegrees > 0,
      mode: this.isAutoDimmingEnabled ? 'auto' : 'manual',
    };
    this.emitIfChanged(next);
  }

  private emitState(): void {
    const current = this.brightnessSubject.value;
    this.emitIfChanged({
      ...current,
      mode: this.isAutoDimmingEnabled ? 'auto' : 'manual',
    });
  }

  /** Avoid re-notifying subscribers when nothing meaningful changed (stops map tile churn). */
  private emitIfChanged(next: BrightnessState): void {
    const prev = this.brightnessSubject.value;
    if (
      prev.mode === next.mode &&
      prev.isDimming === next.isDimming &&
      prev.isDayTime === next.isDayTime &&
      Math.abs(prev.brightness - next.brightness) < 0.01 &&
      Math.abs(prev.sunElevation - next.sunElevation) < 0.25
    ) {
      return;
    }
    this.brightnessSubject.next(next);
  }

  private startUpdateInterval(): void {
    this.stopUpdateInterval();
    this.updateInterval = interval(30000).subscribe(() => {
      if (this.isAutoDimmingEnabled) {
        this.updateBrightness();
      }
    });
  }

  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      this.updateInterval.unsubscribe();
      this.updateInterval = null;
    }
  }
}
