import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, timeout } from 'rxjs';
import { AtmosphericSkyService } from '../atmospheric-sky.service';
import { RainService } from '../rain.service';
import { SkyColorSyncService } from '../sky-color-sync.service';
import { StormPressureService } from '../storm-pressure.service';
import type { WindowViewPlane } from '../../types/window-view-plane';

const OPEN_WEATHER_MAP_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699';

@Injectable({ providedIn: 'root' })
export class WindowViewSkyService {
  skyBackground = '';
  skyBottomColor = 'rgb(135, 206, 235)';
  skyTopColor = 'rgb(25, 25, 112)';
  windowCloudUrl: string | null = null;
  cloudFilter = 'none';
  cloudBacklightClass = '';
  weatherCondition: string | null = null;
  currentWindSpeed = 0;

  private weatherDescription: string | null = null;
  private isUpdatingWeather = false;
  private lastPublishedSkyColors: { bottomColor: string; topColor: string } | null =
    null;

  constructor(
    private http: HttpClient,
    private atmosphericSky: AtmosphericSkyService,
    private rainService: RainService,
    private skyColorSync: SkyColorSyncService,
    private stormPressureService: StormPressureService
  ) {}

  updateWindowCloud(observerLat: number, observerLon: number): void {
    if (!Number.isFinite(observerLat) || !Number.isFinite(observerLon)) {
      this.windowCloudUrl = null;
      return;
    }
    const z = 3;
    const n = 1 << z;
    const latRad = (observerLat * Math.PI) / 180;
    const x = Math.floor(((observerLon + 180) / 360) * n);
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    this.windowCloudUrl = `https://tile.openweathermap.org/map/clouds_new/${z}/${x}/${y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`;
  }

  updateWeather(
    observerLat: number,
    observerLon: number,
    planes: WindowViewPlane[],
    onCompassRefresh: () => void
  ): void {
    if (
      !Number.isFinite(observerLat) ||
      !Number.isFinite(observerLon) ||
      this.isUpdatingWeather
    ) {
      return;
    }
    this.isUpdatingWeather = true;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${observerLat}&lon=${observerLon}&appid=${OPEN_WEATHER_MAP_API_KEY}`;
    this.http
      .get<any>(url)
      .pipe(
        timeout(10000),
        catchError((error) => {
          console.warn('Weather API failed:', error.message || error);
          return of(null);
        })
      )
      .subscribe({
        next: (data) => {
          if (data?.weather?.length) {
            this.weatherCondition = data.weather[0].main;
            this.weatherDescription = data.weather[0].description;
          } else {
            this.weatherCondition = null;
            this.weatherDescription = null;
          }
          this.currentWindSpeed = data?.wind?.speed || 0;
          this.applyRainFromWeather(data);
          this.updateSkyBackground(planes);
          onCompassRefresh();
          this.isUpdatingWeather = false;
        },
        error: () => {
          this.weatherCondition = null;
          this.weatherDescription = null;
          this.rainService.stopRain();
          this.updateSkyBackground(planes);
          onCompassRefresh();
          this.isUpdatingWeather = false;
        },
      });
  }

  private applyRainFromWeather(weatherData: any): void {
    if (!weatherData?.weather?.length) {
      this.rainService.stopRain();
      return;
    }
    const weather = weatherData.weather[0];
    const condition = weather.main?.toLowerCase() || '';
    const description = weather.description?.toLowerCase() || '';
    const isRaining =
      condition.includes('rain') ||
      condition.includes('drizzle') ||
      condition.includes('thunderstorm');
    const humidity = weatherData.main?.humidity || 50;
    const pressure = weatherData.main?.pressure || 1013.25;
    const temperature = weatherData.main?.temp || 288.15;
    const windSpeed = weatherData.wind?.speed || 0;
    const windDirection = weatherData.wind?.deg || 0;
    const visibility = weatherData.visibility || 10000;

    if (isRaining) {
      this.rainService.updateWeatherConditions(
        condition,
        description,
        windSpeed,
        windDirection,
        humidity,
        pressure,
        temperature,
        visibility
      );
    } else {
      this.rainService.stopRain();
    }
    this.stormPressureService.updatePressure(
      pressure,
      temperature,
      humidity,
      windSpeed
    );
  }

  updateSkyBackground(planes: WindowViewPlane[]): void {
    const sun = planes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'sun'
    );
    let sunElevationAngle = 0;
    if (sun && !sun.belowHorizon) {
      sunElevationAngle = (sun.y / 100) * 90;
    } else {
      sunElevationAngle = sun ? -10 : -20;
    }

    let weatherCondition: 'clear' | 'rain' | 'snow' | 'clouds' = 'clear';
    if (this.weatherCondition) {
      const cond = this.weatherCondition.toLowerCase();
      const desc = this.weatherDescription?.toLowerCase() || '';
      if (
        cond.includes('rain') ||
        cond.includes('drizzle') ||
        cond.includes('thunderstorm')
      ) {
        weatherCondition = 'rain';
      } else if (cond.includes('snow')) {
        weatherCondition = 'snow';
      } else if (
        cond.includes('cloud') &&
        !desc.includes('few') &&
        !desc.includes('scattered')
      ) {
        weatherCondition = 'clouds';
      }
    }

    const skyColors = this.atmosphericSky.calculateSkyColors(
      sunElevationAngle,
      weatherCondition
    );
    this.skyBackground = `linear-gradient(to top, ${skyColors.bottomColor} 0%, ${skyColors.topColor} 100%)`;
    this.skyBottomColor = skyColors.bottomColor;
    this.skyTopColor = skyColors.topColor;
    this.updateCloudFiltering(planes, sunElevationAngle);

    const changed =
      !this.lastPublishedSkyColors ||
      this.lastPublishedSkyColors.bottomColor !== skyColors.bottomColor ||
      this.lastPublishedSkyColors.topColor !== skyColors.topColor;
    if (changed) {
      this.skyColorSync.updateSkyColors({
        bottomColor: skyColors.bottomColor,
        topColor: skyColors.topColor,
        timestamp: Date.now(),
      });
      this.lastPublishedSkyColors = {
        bottomColor: skyColors.bottomColor,
        topColor: skyColors.topColor,
      };
    }
  }

  private updateCloudFiltering(
    planes: WindowViewPlane[],
    sunElevationAngle: number
  ): void {
    const moon = planes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'moon'
    );
    if (sunElevationAngle > 15) {
      this.cloudFilter = 'none';
      this.cloudBacklightClass = 'backlit';
    } else if (sunElevationAngle > 0) {
      const brightness = 0.4 + (sunElevationAngle / 15) * 0.6;
      this.cloudFilter = `brightness(${brightness}) contrast(1.1) hue-rotate(5deg)`;
      this.cloudBacklightClass = 'twilight-backlit';
    } else if (sunElevationAngle > -6) {
      const brightness = 0.25 + ((sunElevationAngle + 6) / 6) * 0.15;
      this.cloudFilter = `brightness(${brightness}) contrast(1.2) hue-rotate(10deg) saturate(0.8)`;
      this.cloudBacklightClass = 'twilight-backlit';
    } else if (sunElevationAngle > -12) {
      const brightness = 0.15 + ((sunElevationAngle + 12) / 6) * 0.1;
      this.cloudFilter = `brightness(${brightness}) contrast(1.3) hue-rotate(15deg) saturate(0.6)`;
      this.cloudBacklightClass = 'night-backlit';
    } else {
      let moonInfluence = 0.1;
      if (moon && !moon.belowHorizon) {
        const moonElevation = (moon.y / 100) * 90;
        const moonPhase = moon.moonFraction || 0;
        moonInfluence = 0.1 + (moonElevation / 90) * 0.15 + moonPhase * 0.1;
      }
      const baseBrightness = 0.1 + moonInfluence * 0.5;
      this.cloudFilter = `brightness(${baseBrightness}) contrast(1.4) hue-rotate(20deg) saturate(0.4)`;
      this.cloudBacklightClass = 'night-backlit';
    }
  }
}
