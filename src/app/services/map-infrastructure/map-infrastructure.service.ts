/**
 * Map Infrastructure Service
 * Handles Leaflet map initialization, layer management, and basic map operations
 */

import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MapConfig {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  tileLayer: string;
}

export interface LayerConfig {
  id: string;
  layer: L.Layer;
  zIndex?: number;
  visible?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MapInfrastructureService {
  private map?: L.Map;
  private mapReadySubject = new BehaviorSubject<boolean>(false);
  private layersMap = new Map<string, LayerConfig>();

  public mapReady$ = this.mapReadySubject.asObservable();

  /**
   * Initialize the Leaflet map with provided configuration
   */
  initializeMap(containerId: string, config: MapConfig): L.Map {
    this.map = L.map(containerId, {
      center: config.center,
      zoom: config.zoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Add base tile layer
    L.tileLayer(config.tileLayer, {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.setupCustomPanes();
    this.mapReadySubject.next(true);

    return this.map;
  }

  /**
   * Get the current map instance
   */
  getMap(): L.Map | undefined {
    return this.map;
  }

  /**
   * Add a layer to the map with configuration
   */
  addLayer(config: LayerConfig): void {
    if (!this.map) {
      throw new Error('Map not initialized');
    }

    this.layersMap.set(config.id, config);

    if (config.visible !== false) {
      config.layer.addTo(this.map);
    }

    if (config.zIndex && 'setZIndex' in config.layer) {
      (config.layer as any).setZIndex(config.zIndex);
    }
  }

  /**
   * Remove a layer from the map
   */
  removeLayer(layerId: string): void {
    const layerConfig = this.layersMap.get(layerId);
    if (layerConfig && this.map) {
      this.map.removeLayer(layerConfig.layer);
      this.layersMap.delete(layerId);
    }
  }

  /**
   * Toggle layer visibility
   */
  toggleLayer(layerId: string, visible?: boolean): void {
    const layerConfig = this.layersMap.get(layerId);
    if (!layerConfig || !this.map) return;

    const shouldShow =
      visible !== undefined ? visible : !this.map.hasLayer(layerConfig.layer);

    if (shouldShow) {
      layerConfig.layer.addTo(this.map);
    } else {
      this.map.removeLayer(layerConfig.layer);
    }

    layerConfig.visible = shouldShow;
  }

  /**
   * Update map view
   */
  setView(
    center: [number, number],
    zoom?: number,
    options?: L.ZoomPanOptions
  ): void {
    if (!this.map) return;

    const targetZoom = zoom !== undefined ? zoom : this.map.getZoom();
    this.map.setView(center, targetZoom, options);
  }

  /**
   * Pan to location with animation
   */
  panTo(center: [number, number], options?: L.PanOptions): void {
    if (!this.map) return;
    this.map.panTo(center, options);
  }

  /**
   * Get current map center
   */
  getCenter(): L.LatLng | undefined {
    return this.map?.getCenter();
  }

  /**
   * Get current zoom level
   */
  getZoom(): number | undefined {
    return this.map?.getZoom();
  }

  /**
   * Setup custom panes for layering
   */
  private setupCustomPanes(): void {
    if (!this.map) return;

    const panes = [
      { name: 'radiusPane', zIndex: 250 },
      { name: 'airportRadiusPane', zIndex: 260 },
      { name: 'historyTrailPane', zIndex: 280 },
      { name: 'pathPane', zIndex: 310 },
      { name: 'pathArrowheadPane', zIndex: 315 },
      { name: 'conePane', zIndex: 410 },
      { name: 'hoverPane', zIndex: 420 },
      { name: 'cloudPane', zIndex: 620 },
      { name: 'rainPane', zIndex: 630 },
    ];

    panes.forEach((pane) => {
      this.map!.createPane(pane.name);
      const paneElement = this.map!.getPane(pane.name) as HTMLElement;
      paneElement.style.zIndex = pane.zIndex.toString();

      // Disable pointer events for overlay panes
      if (['cloudPane', 'rainPane'].includes(pane.name)) {
        paneElement.style.pointerEvents = 'none';
      }
    });
  }

  /**
   * Cleanup method for service destruction
   */
  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    this.layersMap.clear();
    this.mapReadySubject.next(false);
  }
}
