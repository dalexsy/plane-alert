import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Observable, of, catchError } from 'rxjs';

// OpenWeatherMap API key
const OPEN_WEATHER_MAP_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699';

export interface WeatherData {
  windSpeed: number;
  windDirection: number;
  windStat: string;
  temperature: number;
  humidity: number;
  pressure: number;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherOverlayService {
  private map: L.Map | null = null;
  private cloudLayer: L.TileLayer | null = null;
  private rainLayer: L.TileLayer | null = null;
  private currentWeatherData: WeatherData | null = null;

  private showCloudCover = true;
  private showRainCover = true;

  constructor(private http: HttpClient) {}

  initializeWithMap(map: L.Map): void {
    this.map = map;
  }

  /**
   * Toggle cloud cover visibility
   */
  setCloudCoverVisible(visible: boolean): void {
    this.showCloudCover = visible;
    this.updateCloudLayer();
  }

  /**
   * Toggle rain cover visibility
   */
  setRainCoverVisible(visible: boolean): void {
    this.showRainCover = visible;
    this.updateRainLayer();
  }

  /**
   * Update cloud layer
   */
  private updateCloudLayer(): void {
    if (!this.map) return;

    if (this.cloudLayer) {
      this.map.removeLayer(this.cloudLayer);
      this.cloudLayer = null;
    }

    if (this.showCloudCover) {
      this.cloudLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
        {
          opacity: 0.6,
          attribution: '© OpenWeatherMap'
        }
      ).addTo(this.map);
    }
  }

  /**
   * Update rain layer
   */
  private updateRainLayer(): void {
    if (!this.map) return;

    if (this.rainLayer) {
      this.map.removeLayer(this.rainLayer);
      this.rainLayer = null;
    }

    if (this.showRainCover) {
      this.rainLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
        {
          opacity: 0.6,
          attribution: '© OpenWeatherMap'
        }
      ).addTo(this.map);
    }
  }

  /**
   * Fetch weather data for coordinates
   */
  fetchWeatherData(lat: number, lon: number): Observable<WeatherData | null> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_MAP_API_KEY}&units=metric`;

    return this.http.get<any>(url).pipe(
      catchError(error => {
        console.warn('Weather data fetch failed:', error);
        return of(null);
      })
    );
  }

  /**
   * Process weather API response
   */
  processWeatherData(response: any): WeatherData | null {
    if (!response) return null;

    try {
      const weatherData: WeatherData = {
        windSpeed: response.wind?.speed || 0,
        windDirection: response.wind?.deg || 0,
        windStat: this.getWindDescription(response.wind?.speed || 0),
        temperature: response.main?.temp || 0,
        humidity: response.main?.humidity || 0,
        pressure: response.main?.pressure || 0
      };

      this.currentWeatherData = weatherData;
      return weatherData;
    } catch (error) {
      console.warn('Weather data processing failed:', error);
      return null;
    }
  }

  /**
   * Get wind description based on speed
   */
  private getWindDescription(speedMs: number): string {
    const speedKmh = speedMs * 3.6;

    if (speedKmh < 1) return 'Calm';
    if (speedKmh < 6) return 'Light air';
    if (speedKmh < 12) return 'Light breeze';
    if (speedKmh < 20) return 'Gentle breeze';
    if (speedKmh < 29) return 'Moderate breeze';
    if (speedKmh < 39) return 'Fresh breeze';
    if (speedKmh < 50) return 'Strong breeze';
    if (speedKmh < 62) return 'Near gale';
    if (speedKmh < 75) return 'Gale';
    if (speedKmh < 89) return 'Strong gale';
    if (speedKmh < 103) return 'Storm';
    if (speedKmh < 118) return 'Violent storm';
    return 'Hurricane';
  }

  /**
   * Convert wind speed to different units
   */
  convertWindSpeed(speedMs: number, unit: string): number {
    switch (unit) {
      case 'knots':
        return Math.round(speedMs * 1.94384 * 100) / 100;
      case 'km/h':
        return Math.round(speedMs * 3.6 * 100) / 100;
      case 'mph':
        return Math.round(speedMs * 2.23694 * 100) / 100;
      default: // m/s
        return Math.round(speedMs * 100) / 100;
    }
  }

  /**
   * Get wind direction from degrees
   */
  getWindFromDirection(deg: number): string {
    const directions = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW',
      'W', 'WNW', 'NW', 'NNW'
    ];

    const index = Math.round((deg % 360) / 22.5) % 16;
    return directions[index];
  }

  /**
   * Get current weather data
   */
  getCurrentWeatherData(): WeatherData | null {
    return this.currentWeatherData;
  }

  /**
   * Clear all weather layers
   */
  clearWeatherLayers(): void {
    if (!this.map) return;

    if (this.cloudLayer) {
      this.map.removeLayer(this.cloudLayer);
      this.cloudLayer = null;
    }

    if (this.rainLayer) {
      this.map.removeLayer(this.rainLayer);
      this.rainLayer = null;
    }
  }

  /**
   * Initialize weather layers
   */
  initializeWeatherLayers(): void {
    this.updateCloudLayer();
    this.updateRainLayer();
  }

  /**
   * Get current layer visibility states
   */
  getLayerStates(): { cloudCover: boolean; rainCover: boolean } {
    return {
      cloudCover: this.showCloudCover,
      rainCover: this.showRainCover
    };
  }
}