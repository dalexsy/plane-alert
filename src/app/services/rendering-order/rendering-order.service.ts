import { Injectable } from '@angular/core';
import * as L from 'leaflet';

export type PaneKey =
  | 'tile'
  | 'imagery'
  | 'boundary'
  | 'radius'
  | 'airportRadius'
  | 'historyTrail'
  | 'planeMarker'
  | 'cone'
  | 'path'
  | 'arrowhead'
  | 'hover'
  | 'overlay'
  | 'popup';

@Injectable({ providedIn: 'root' })
export class RenderingOrderService {
  paneNames: Record<PaneKey, string> = {
    tile: 'tilePane',
    imagery: 'imageryPane',
    boundary: 'boundaryPane',
    radius: 'radiusPane',
    airportRadius: 'airportRadiusPane',
    historyTrail: 'historyTrailPane',
    planeMarker: 'markerPane',
    cone: 'conePane',
    path: 'pathPane',
    arrowhead: 'pathArrowheadPane',
    hover: 'hoverPane',
    overlay: 'overlayPane',
    popup: 'popupPane',
  };

  zIndices: Record<PaneKey, number> = {
    tile: 200,
    imagery: 200,
    boundary: 200,
    radius: 250,
    airportRadius: 260,
    historyTrail: 280,
    overlay: 300,
    path: 310,
    arrowhead: 315,
    planeMarker: 400,
    cone: 410,
    hover: 420,
    popup: 600,
  };

  // Store SVG renderers for vector panes
  private svgRenderers: Partial<Record<PaneKey, L.SVG>> = {};

  init(map: L.Map): void {
    Object.keys(this.paneNames).forEach((key) => {
      const paneKey = key as PaneKey;
      const paneName = this.paneNames[paneKey];
      if (!map.getPane(paneName)) {
        map.createPane(paneName);
        const pane = map.getPane(paneName);
        const z = this.zIndices[paneKey];
        if (pane && z !== undefined) {
          pane.style.zIndex = `${z}`;
        }
      }
      // Initialize SVG renderers for vector panes
      if (
        [
          'overlay',
          'radius',
          'airportRadius',
          'historyTrail',
          'path',
          'arrowhead',
          'cone',
        ].includes(paneKey)
      ) {
        const renderer = L.svg({ pane: this.paneNames[paneKey] });
        renderer.addTo(map);
        this.svgRenderers[paneKey] = renderer;
      }
    });
  }

  // Get L.SVG renderer for a pane
  getRenderer(key: PaneKey): L.SVG | undefined {
    return this.svgRenderers[key];
  }

  getPaneName(key: PaneKey): string {
    return this.paneNames[key];
  }
}
