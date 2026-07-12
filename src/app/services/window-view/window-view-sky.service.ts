import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, timeout } from 'rxjs';
import { AtmosphericSkyService } from '../atmospheric-sky/atmospheric-sky.service';
import { RainService } from '../rain/rain.service';
import { SkyColorSyncService } from '../sky-color-sync/sky-color-sync.service';
import { StormPressureService } from '../storm-pressure/storm-pressure.service';
import type { WindowViewPlane } from '../../types/window-view-plane';
import {
  applyWindowViewRainFromWeather,
  computeSunElevationFromPlanes,
  computeWindowViewCloudPresentation,
  resolveWindowViewWeatherKind,
} from './window-view-sky-weather.util';

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
      .get<unknown>(url)
      .pipe(
        timeout(10000),
        catchError((error) => {
          console.warn('Weather API failed:', error.message || error);
          return of(null);
        })
      )
      .subscribe({
        next: (data) => {
          const payload = data as {
            weather?: { main?: string; description?: string }[];
            wind?: { speed?: number };
          } | null;
          if (payload?.weather?.length) {
            this.weatherCondition = payload.weather[0].main ?? null;
            this.weatherDescription = payload.weather[0].description ?? null;
          } else {
            this.weatherCondition = null;
            this.weatherDescription = null;
          }
          this.currentWindSpeed = payload?.wind?.speed || 0;
          applyWindowViewRainFromWeather(
            data,
            this.rainService,
            this.stormPressureService
          );
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

  updateSkyBackground(planes: WindowViewPlane[]): void {
    const sunElevationAngle = computeSunElevationFromPlanes(planes);
    const weatherKind = resolveWindowViewWeatherKind(
      this.weatherCondition,
      this.weatherDescription
    );
    const skyColors = this.atmosphericSky.calculateSkyColors(
      sunElevationAngle,
      weatherKind
    );
    this.skyBackground = `linear-gradient(to top, ${skyColors.bottomColor} 0%, ${skyColors.topColor} 100%)`;
    this.skyBottomColor = skyColors.bottomColor;
    this.skyTopColor = skyColors.topColor;

    const cloud = computeWindowViewCloudPresentation(planes, sunElevationAngle);
    this.cloudFilter = cloud.cloudFilter;
    this.cloudBacklightClass = cloud.cloudBacklightClass;

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
}
