import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import {
  RainConfiguration,
  RainDrop,
  DEFAULT_RAIN_CONFIG,
  WEATHER_INTENSITY_MAP,
} from './rain-types';
import {
  calculateDropCount,
  calculateFallSpeed,
  calculateRainColor,
  calculateRainIntensity,
  calculateSizeVariance,
  calculateWindEffect,
  fadeRainDropsStep,
  generateRainDrops,
  getIntensityForDescription,
  shouldActivateRain,
  updateRainDropPositions,
} from './rain-calc.util';

export type { RainConfiguration, RainDrop } from './rain-types';

@Injectable({ providedIn: 'root' })
export class RainService {
  private readonly defaultConfig = DEFAULT_RAIN_CONFIG;
  private readonly weatherIntensityMap = WEATHER_INTENSITY_MAP;

  private currentConfig$ = new BehaviorSubject<RainConfiguration>(this.defaultConfig);
  private rainDrops$ = new BehaviorSubject<RainDrop[]>([]);
  private isRaining$ = new BehaviorSubject<boolean>(false);

  private animationFrameId: number | null = null;
  private lastUpdateTime = 0;

  constructor(private settings: SettingsService) {
    this.rainDrops$.next(generateRainDrops(this.defaultConfig));
  }

  getConfiguration(): Observable<RainConfiguration> {
    return this.currentConfig$.asObservable();
  }

  getRainDrops(): Observable<RainDrop[]> {
    return this.rainDrops$.asObservable();
  }

  getIsRaining(): Observable<boolean> {
    return this.isRaining$.asObservable();
  }

  updateWeatherConditions(
    condition: string,
    description: string,
    windSpeed = 0,
    windDirection = 0,
    humidity = 50,
    pressure = 1013.25,
    temperature = 288.15,
    visibility = 10000
  ): void {
    if (!shouldActivateRain(condition, description)) {
      this.stopRain();
      return;
    }
    const intensity = calculateRainIntensity(
      condition,
      description,
      humidity,
      pressure,
      temperature,
      this.weatherIntensityMap
    );
    const windAngle = calculateWindEffect(windSpeed, windDirection);
    const fallSpeed = calculateFallSpeed(intensity, pressure, temperature, humidity, this.defaultConfig.fallSpeed);
    const dropCount = calculateDropCount(intensity, visibility, humidity, this.defaultConfig.dropCount);
    const sizeVariance = calculateSizeVariance(intensity, pressure, humidity, this.defaultConfig.sizeVariance);
    const color = calculateRainColor(condition, description, temperature, visibility);
    this.startRain({
      intensity,
      windAngle,
      fallSpeed,
      dropCount,
      sizeVariance,
      color,
      opacity: Math.max(0.3, intensity * 0.8),
    });
  }

  startRain(config?: Partial<RainConfiguration>): void {
    if (!this.settings.animationsEnabled) {
      this.stopRain();
      return;
    }
    const merged = { ...this.currentConfig$.value, ...config };
    this.currentConfig$.next(merged);
    this.isRaining$.next(true);
    this.rainDrops$.next(generateRainDrops(merged));
    this.startAnimation();
  }

  stopRain(): void {
    this.isRaining$.next(false);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.fadeOutRainDrops();
  }

  updateConfiguration(config: Partial<RainConfiguration>): void {
    const merged = { ...this.currentConfig$.value, ...config };
    this.currentConfig$.next(merged);
    if (this.isRaining$.value) {
      this.rainDrops$.next(generateRainDrops(merged));
    }
  }

  getIntensityForDescription(description: string): number {
    return getIntensityForDescription(description, this.weatherIntensityMap);
  }

  dispose(): void {
    this.stopRain();
    this.currentConfig$.complete();
    this.rainDrops$.complete();
    this.isRaining$.complete();
  }

  private startAnimation(): void {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.lastUpdateTime = Date.now();
    this.animate();
  }

  private animate(): void {
    if (!this.isRaining$.value) return;
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    const config = this.currentConfig$.value;
    const updated = updateRainDropPositions(this.rainDrops$.value, config, deltaTime);
    this.rainDrops$.next(updated);
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private fadeOutRainDrops(): void {
    const faded = fadeRainDropsStep(this.rainDrops$.value);
    this.rainDrops$.next(faded);
    if (faded.some((drop) => drop.opacity > 0.05)) {
      setTimeout(() => this.fadeOutRainDrops(), 100);
    } else {
      this.rainDrops$.next([]);
    }
  }
}
