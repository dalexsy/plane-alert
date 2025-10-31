import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { MAP_THEMES } from '../config/map-themes.config';
import { BrightnessService, BrightnessState } from './brightness.service';

@Injectable({
  providedIn: 'root',
})
export class MapThemeService {
  private currentTileLayers: L.TileLayer[] = [];
  private map: L.Map | null = null;

  constructor(private brightnessService: BrightnessService) {
    // Listen for day/night changes and switch themes automatically
    this.brightnessService.brightness$.subscribe(
      (brightnessState: BrightnessState) => {
        this.updateMapTheme(brightnessState);
      }
    );
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

    // Remove current tile layers
    this.currentTileLayers.forEach((layer) => {
      this.map!.removeLayer(layer);
    });
    this.currentTileLayers = [];

    // Choose theme: day or night based on sun elevation
    const isNight = brightnessState.sunElevation < 0;
    const theme = isNight ? MAP_THEMES.night : MAP_THEMES.day;

    if (isNight) {
      // Night theme: single layer
      const nightTheme = theme as { url: string; attribution: string };
      const tileLayer = L.tileLayer(nightTheme.url, {
        attribution: nightTheme.attribution,
        maxZoom: 18,
        minZoom: 1,
      });
      this.currentTileLayers.push(tileLayer);
      tileLayer.addTo(this.map);
    } else {
      // Day theme: satellite imagery + places labels only (cleaner)
      const dayTheme = theme as {
        imagery: { url: string; attribution: string };
        labels: { url: string; attribution: string };
      };

      const imageryLayer = L.tileLayer(dayTheme.imagery.url, {
        attribution: dayTheme.imagery.attribution,
        maxZoom: 18,
        minZoom: 1,
      });

      const placesLayer = L.tileLayer(dayTheme.labels.url, {
        attribution: dayTheme.labels.attribution,
        maxZoom: 18,
        minZoom: 1,
      });

      this.currentTileLayers.push(imageryLayer, placesLayer);
      imageryLayer.addTo(this.map);
      placesLayer.addTo(this.map);
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy(): void {
    this.currentTileLayers.forEach((layer) => {
      if (this.map) {
        this.map.removeLayer(layer);
      }
    });
    this.currentTileLayers = [];
    this.map = null;
  }
}
