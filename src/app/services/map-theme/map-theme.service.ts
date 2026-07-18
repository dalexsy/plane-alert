import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { MAP_THEMES } from '../../config/map-themes.config';
import { BrightnessService, BrightnessState } from '../brightness/brightness.service';

type MapThemeMode = 'day' | 'night';

@Injectable({
  providedIn: 'root',
})
export class MapThemeService {
  private currentTileLayers: L.TileLayer[] = [];
  private map: L.Map | null = null;
  /** Last applied basemap mode — skip rebuild when unchanged (avoids full-map flash). */
  private appliedMode: MapThemeMode | null = null;

  constructor(private brightnessService: BrightnessService) {
    this.brightnessService.brightness$.subscribe((brightnessState: BrightnessState) => {
      this.updateMapTheme(brightnessState);
    });
  }

  initializeWithMap(map: L.Map): void {
    this.map = map;
    this.appliedMode = null;
    this.updateMapTheme(this.brightnessService.getCurrentState());
  }

  private updateMapTheme(brightnessState: BrightnessState): void {
    if (!this.map) return;

    // Civil twilight (-6°) — same threshold as before; only rebuild on day↔night flip.
    const mode: MapThemeMode = brightnessState.sunElevation < -6 ? 'night' : 'day';
    if (mode === this.appliedMode && this.currentTileLayers.length > 0) {
      return;
    }

    this.currentTileLayers.forEach((layer) => this.map!.removeLayer(layer));
    this.currentTileLayers = [];

    if (mode === 'night') {
      const nightTheme = MAP_THEMES.night;
      const tileLayer = L.tileLayer(nightTheme.url, {
        attribution: nightTheme.attribution,
        maxZoom: 18,
        minZoom: 1,
      });
      this.currentTileLayers.push(tileLayer);
      tileLayer.addTo(this.map);
    } else {
      const dayTheme = MAP_THEMES.day;
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

    this.appliedMode = mode;
  }

  destroy(): void {
    this.currentTileLayers.forEach((layer) => {
      if (this.map) this.map.removeLayer(layer);
    });
    this.currentTileLayers = [];
    this.appliedMode = null;
    this.map = null;
  }
}
