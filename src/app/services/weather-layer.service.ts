import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root',
})
export class WeatherLayerService {
  // Tile layer for cloud coverage overlay from OpenWeatherMap
  private cloudLayer?: L.TileLayer;
  // Tile layer for rain coverage overlay from OpenWeatherMap
  private rainLayer?: L.TileLayer;

  // Opacity settings for weather layers
  cloudOpacity: number = 1;
  rainOpacity: number = 0.8;

  constructor(private settings: SettingsService) {}

  /**
   * Initialize weather layers on the map
   */
  initializeLayers(map: L.Map): void {
    // Initialize cloud layer
    this.cloudLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=ffcc03a274b2d049bf4633584e7b5699`,
      {
        attribution: '© OpenWeatherMap',
        opacity: this.cloudOpacity,
      }
    );

    // Initialize rain layer
    this.rainLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=ffcc03a274b2d049bf4633584e7b5699`,
      {
        attribution: '© OpenWeatherMap',
        opacity: this.rainOpacity,
      }
    );
  }

  /**
   * Toggle display of cloud coverage layer
   */
  toggleCloudCover(map: L.Map, show: boolean): void {
    if (this.cloudLayer) {
      if (show) {
        this.cloudLayer.addTo(map);
      } else {
        this.cloudLayer.remove();
      }
    }
    this.settings.setShowCloudCover(show);
  }

  /**
   * Toggle display of rain coverage layer
   */
  toggleRainCover(map: L.Map, show: boolean): void {
    if (this.rainLayer) {
      if (show) {
        this.rainLayer.addTo(map);
      } else {
        this.rainLayer.remove();
      }
    }
    this.settings.setShowRainCover(show);
  }

  /**
   * Adjust cloud layer opacity
   */
  setCloudOpacity(opacity: number): void {
    this.cloudOpacity = opacity;
    if (this.cloudLayer) {
      this.cloudLayer.setOpacity(opacity);
    }
  }

  /**
   * Adjust rain layer opacity
   */
  setRainOpacity(opacity: number): void {
    this.rainOpacity = opacity;
    if (this.rainLayer) {
      this.rainLayer.setOpacity(opacity);
    }
  }

  /**
   * Apply sky colors from window view to cloud layer for visual synchronization
   */
  applySkyColorsToCloudLayer(skyColors: {
    bottomColor: string;
    topColor: string;
    timestamp: number;
  }): void {
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
   * Clean up weather layers
   */
  destroy(): void {
    if (this.cloudLayer) {
      this.cloudLayer.remove();
    }
    if (this.rainLayer) {
      this.rainLayer.remove();
    }
  }
}
