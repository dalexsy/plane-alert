import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Observable, of, catchError, Subject } from 'rxjs';

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

export interface SkyColors {
  bottomColor: string;
  topColor: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class WeatherOverlayService {
  private map: L.Map | null = null;
  private cloudLayer: L.TileLayer | null = null;
  private rainLayer: L.TileLayer | null = null;
  private currentWeatherData: WeatherData | null = null;

  private showCloudCover = true;
  private showRainCover = true;
  private cloudOpacity = 1;
  private rainOpacity = 0.8;

  // Sky color synchronization
  private skyColorsSubject = new Subject<SkyColors>();
  public skyColors$ = this.skyColorsSubject.asObservable();

  constructor(private http: HttpClient) {}

  initializeWithMap(map: L.Map): void {
    this.map = map;
    this.initializeWeatherLayers();
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
   * Set cloud layer opacity
   */
  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    if (this.cloudLayer) {
      this.cloudLayer.setOpacity(opacity);
    }
  }

  /**
   * Set rain layer opacity
   */
  setRainOpacity(opacity: number): void {
    this.rainOpacity = opacity;
    if (this.rainLayer) {
      this.rainLayer.setOpacity(opacity);
    }
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
      // Create a custom pane for cloud coverage above markers
      if (!this.map.getPane('cloudPane')) {
        this.map.createPane('cloudPane');
        const cloudPane = this.map.getPane('cloudPane') as HTMLElement;
        cloudPane.style.zIndex = '620';
        cloudPane.style.pointerEvents = 'none';
      }

      this.cloudLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
        {
          pane: 'cloudPane',
          className: 'cloud-layer',
          opacity: this.cloudOpacity,
          attribution: 'Weather data © OpenWeatherMap',
        }
      )
        .addTo(this.map)
        .on('tileerror', () => {
          // ignore cloud tile errors in console
        });
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
      // Create a custom pane for rain coverage above markers, below clouds
      if (!this.map.getPane('rainPane')) {
        this.map.createPane('rainPane');
        const rainPane = this.map.getPane('rainPane') as HTMLElement;
        rainPane.style.zIndex = '615'; // Below cloudPane (620)
        rainPane.style.pointerEvents = 'none';
      }

      this.rainLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`,
        {
          pane: 'rainPane',
          className: 'rain-layer',
          opacity: this.rainOpacity,
          attribution: 'Weather data © OpenWeatherMap',
        }
      )
        .addTo(this.map)
        .on('tileerror', () => {
          // ignore rain tile errors in console
        });
    }
  }

  /**
   * Apply sky colors from window view to cloud layer for visual synchronization
   */
  applySkyColorsToCloudLayer(skyColors: SkyColors): void {
    if (!this.cloudLayer) return;

    // Create CSS filter effects based on sky colors
    const cloudElements = document.querySelectorAll('.cloud-layer');
    cloudElements.forEach((element) => {
      const el = element as HTMLElement;

      // Apply a subtle color overlay that blends with the sky colors
      const filter = this.createCloudLayerFilter(
        skyColors.bottomColor,
        skyColors.topColor
      );
      el.style.filter = filter;
      el.style.mixBlendMode = 'multiply';
    });
  }

  /**
   * Create CSS filter string for cloud layer based on sky colors
   */
  private createCloudLayerFilter(
    bottomColor: string,
    topColor: string
  ): string {
    // Extract RGB values from the colors
    const bottomRgb = this.extractRgbFromColor(bottomColor);
    const topRgb = this.extractRgbFromColor(topColor);

    if (!bottomRgb || !topRgb) return '';

    // Calculate average color for cloud tinting
    const avgR = Math.round((bottomRgb.r + topRgb.r) / 2);
    const avgG = Math.round((bottomRgb.g + topRgb.g) / 2);
    const avgB = Math.round((bottomRgb.b + topRgb.b) / 2);

    // Calculate brightness and color intensity
    const brightness = (avgR + avgG + avgB) / (3 * 255);
    const saturation = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);

    // Create filter based on atmospheric conditions
    const hueShift = this.calculateHueShift(avgR, avgG, avgB);
    const saturationAdjust = Math.max(
      0.8,
      Math.min(1.2, 1 + (saturation / 255) * 0.3)
    );
    const brightnessAdjust = Math.max(0.7, Math.min(1.3, brightness * 1.2));

    return `hue-rotate(${hueShift}deg) saturate(${saturationAdjust}) brightness(${brightnessAdjust}) contrast(1.1)`;
  }

  /**
   * Extract RGB values from color string
   */
  private extractRgbFromColor(
    color: string
  ): { r: number; g: number; b: number } | null {
    // Handle various color formats (hex, rgb, rgba)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]),
          g: parseInt(match[1]),
          b: parseInt(match[2]),
        };
      }
    }
    return null;
  }

  /**
   * Calculate hue shift based on RGB values
   */
  private calculateHueShift(r: number, g: number, b: number): number {
    // Calculate hue shift based on dominant color
    if (r > g && r > b) {
      // Red dominant - sunrise/sunset tones
      return -10 + (g / 255) * 20;
    } else if (b > r && b > g) {
      // Blue dominant - day/night tones
      return 10 - (r / 255) * 20;
    } else {
      // Green or mixed - neutral tones
      return 0;
    }
  }

  /**
   * Emit sky colors for subscribers
   */
  emitSkyColors(skyColors: SkyColors): void {
    this.skyColorsSubject.next(skyColors);
  }

  /**
   * Fetch weather data for coordinates
   */
  fetchWeatherData(lat: number, lon: number): Observable<WeatherData | null> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_MAP_API_KEY}&units=metric`;

    return this.http.get<any>(url).pipe(
      catchError((error) => {
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
        pressure: response.main?.pressure || 0,
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
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
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
   * Get current layer visibility states and opacities
   */
  getLayerStates(): {
    cloudCover: boolean;
    rainCover: boolean;
    cloudOpacity: number;
    rainOpacity: number;
  } {
    return {
      cloudCover: this.showCloudCover,
      rainCover: this.showRainCover,
      cloudOpacity: this.cloudOpacity,
      rainOpacity: this.rainOpacity,
    };
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    this.clearWeatherLayers();
    this.skyColorsSubject.complete();
  }
}
