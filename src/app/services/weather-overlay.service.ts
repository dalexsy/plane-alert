import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Observable, of, catchError, Subject } from 'rxjs';
import {
  applySkyColorsToCloudElements,
  convertWindSpeed,
  getWindDescription,
  getWindFromDirection,
  updateCloudLayer,
  updateRainLayer,
  WeatherLayerCtx,
} from './weather-overlay/weather-overlay-layers.util';

export interface WeatherData {
  windSpeed: number;
  windDirection: number;
  windStat: string;
  temperature: number;
  humidity: number;
  pressure: number;
}

export interface SkyColors {
  bottomColor: string;
  topColor: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class WeatherOverlayService {
  private map: L.Map | null = null;
  private cloudLayer: L.TileLayer | null = null;
  private rainLayer: L.TileLayer | null = null;
  private currentWeatherData: WeatherData | null = null;
  private showCloudCover = true;
  private showRainCover = true;
  private cloudOpacity = 1;
  private rainOpacity = 0.8;
  private skyColorsSubject = new Subject<SkyColors>();
  public skyColors$ = this.skyColorsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private layerCtx(): WeatherLayerCtx {
    return {
      map: this.map,
      cloudLayer: this.cloudLayer,
      rainLayer: this.rainLayer,
      showCloudCover: this.showCloudCover,
      showRainCover: this.showRainCover,
      cloudOpacity: this.cloudOpacity,
      rainOpacity: this.rainOpacity,
      setCloudLayer: (layer) => { this.cloudLayer = layer; },
      setRainLayer: (layer) => { this.rainLayer = layer; },
    };
  }

  initializeWithMap(map: L.Map): void {
    this.map = map;
    this.initializeWeatherLayers();
  }

  setCloudCoverVisible(visible: boolean): void {
    this.showCloudCover = visible;
    updateCloudLayer(this.layerCtx());
  }

  setRainCoverVisible(visible: boolean): void {
    this.showRainCover = visible;
    updateRainLayer(this.layerCtx());
  }

  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    updateCloudLayer(this.layerCtx());
  }

  setRainOpacity(opacity: number): void {
    this.rainOpacity = opacity;
    updateRainLayer(this.layerCtx());
  }

  applySkyColorsToCloudLayer(skyColors: SkyColors): void {
    if (!this.cloudLayer) return;
    applySkyColorsToCloudElements(skyColors);
  }

  emitSkyColors(skyColors: SkyColors): void {
    this.skyColorsSubject.next(skyColors);
  }

  fetchWeatherData(lat: number, lon: number): Observable<WeatherData | null> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=ffcc03a274b2d049bf4633584e7b5699&units=metric`;
    return this.http.get<any>(url).pipe(catchError((error) => {
      console.warn('Weather data fetch failed:', error);
      return of(null);
    }));
  }

  processWeatherData(response: any): WeatherData | null {
    if (!response) return null;
    try {
      const weatherData: WeatherData = {
        windSpeed: response.wind?.speed || 0,
        windDirection: response.wind?.deg || 0,
        windStat: getWindDescription(response.wind?.speed || 0),
        temperature: response.main?.temp || 0,
        humidity: response.main?.humidity || 0,
        pressure: response.main?.pressure || 0,
      };
      this.currentWeatherData = weatherData;
      return weatherData;
    } catch (error) {
      console.warn('Weather data processing failed:', error);
      return null;
    }
  }

  convertWindSpeed = convertWindSpeed;
  getWindFromDirection = getWindFromDirection;

  getCurrentWeatherData(): WeatherData | null {
    return this.currentWeatherData;
  }

  clearWeatherLayers(): void {
    if (!this.map) return;
    if (this.cloudLayer) { this.map.removeLayer(this.cloudLayer); this.cloudLayer = null; }
    if (this.rainLayer) { this.map.removeLayer(this.rainLayer); this.rainLayer = null; }
  }

  initializeWeatherLayers(): void {
    updateCloudLayer(this.layerCtx());
    updateRainLayer(this.layerCtx());
  }

  getLayerStates(): { cloudCover: boolean; rainCover: boolean; cloudOpacity: number; rainOpacity: number } {
    return { cloudCover: this.showCloudCover, rainCover: this.showRainCover, cloudOpacity: this.cloudOpacity, rainOpacity: this.rainOpacity };
  }

  destroy(): void {
    this.clearWeatherLayers();
    this.skyColorsSubject.complete();
  }
}
