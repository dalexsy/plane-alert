import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import * as L from 'leaflet';
import { createCloudLayerFilter } from './weather-cloud-filter.util';

@Injectable({
  providedIn: 'root',
})
export class WeatherLayerService {
  private cloudLayer?: L.TileLayer;
  private rainLayer?: L.TileLayer;

  cloudOpacity: number = 1;
  rainOpacity: number = 0.8;

  constructor(private settings: SettingsService) {}

  initializeLayers(map: L.Map): void {
    this.cloudLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=ffcc03a274b2d049bf4633584e7b5699`,
      {
        attribution: '© OpenWeatherMap',
        opacity: this.cloudOpacity,
      }
    );

    this.rainLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=ffcc03a274b2d049bf4633584e7b5699`,
      {
        attribution: '© OpenWeatherMap',
        opacity: this.rainOpacity,
      }
    );
  }

  toggleCloudCover(map: L.Map, show: boolean): void {
    if (this.cloudLayer) {
      if (show) {
        this.cloudLayer.addTo(map);
      } else {
        this.cloudLayer.remove();
      }
    }
  }

  toggleRainCover(map: L.Map, show: boolean): void {
    if (this.rainLayer) {
      if (show) {
        this.rainLayer.addTo(map);
      } else {
        this.rainLayer.remove();
      }
    }
  }

  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    if (this.cloudLayer) {
      this.cloudLayer.setOpacity(opacity);
    }
  }

  setRainOpacity(opacity: number): void {
    this.rainOpacity = opacity;
    if (this.rainLayer) {
      this.rainLayer.setOpacity(opacity);
    }
  }

  applySkyColorsToCloudLayer(skyColors: {
    bottomColor: string;
    topColor: string;
    timestamp: number;
  }): void {
    if (!this.cloudLayer) return;

    const cloudElements = document.querySelectorAll('.cloud-layer');
    cloudElements.forEach((element) => {
      const el = element as HTMLElement;
      const filter = createCloudLayerFilter(
        skyColors.bottomColor,
        skyColors.topColor
      );
      el.style.filter = filter;
      el.style.mixBlendMode = 'multiply';
    });
  }

  destroy(): void {
    if (this.cloudLayer) {
      this.cloudLayer.remove();
    }
    if (this.rainLayer) {
      this.rainLayer.remove();
    }
  }
}
