import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { MAP_THEMES } from '../config/map-themes.config';
import { BrightnessService, BrightnessState } from './brightness.service';

@Injectable({
  providedIn: 'root'
})
export class MapThemeService {
  private currentTileLayer: L.TileLayer | null = null;
  private map: L.Map | null = null;

  constructor(private brightnessService: BrightnessService) {
    // Listen for day/night changes and switch themes automatically
    this.brightnessService.brightness$.subscribe((brightnessState: BrightnessState) => {
      this.updateMapTheme(brightnessState);
    });
  }

  /**
   * Initialize with map instance
   */
  initializeWithMap(map: L.Map): void {
    this.map = map;
    // Apply initial theme based on current time
    const currentState = this.brightnessService.getCurrentState();
    this.updateMapTheme(currentState);
  }

  /**
   * Switch map theme based on day/night
   */
  private updateMapTheme(brightnessState: BrightnessState): void {
    if (!this.map) return;

    // Remove current tile layer
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    // Choose theme: day or night based on sun elevation
    // Use night theme when sun is below horizon (like after sunset)
    const isNight = brightnessState.sunElevation < 0;
    const theme = isNight ? MAP_THEMES.night : MAP_THEMES.day;
    
    // Create new tile layer with direct URL
    this.currentTileLayer = L.tileLayer(theme.url, {
      attribution: theme.attribution,
      maxZoom: 18,
      minZoom: 1
    });

    // Add to map
    this.currentTileLayer.addTo(this.map);
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy(): void {
    if (this.currentTileLayer && this.map) {
      this.map.removeLayer(this.currentTileLayer);
    }
    this.currentTileLayer = null;
    this.map = null;
  }
}
