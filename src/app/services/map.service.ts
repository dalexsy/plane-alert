import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { ensureStripedPattern } from '../utils/svg-utils';

@Injectable({ providedIn: 'root' })
export class MapService {
  // mainRadiusCircle drawn directly into overlayPane
  private map!: L.Map;
  private currentLocationMarker!: L.Marker;
  // Manage radii centrally
  private mainRadiusCircle?: L.Circle;
  private airportCircles: Map<number, L.Circle> = new Map();
  private radiusLayerLocked: boolean = false;

  initializeMap(
    mapId: string,
    lat: number,
    lon: number,
    // initial radii can be added after initialization via service methods
    onDblClick: (lat: number, lon: number) => void
  ): L.Map {
    this.map = L.map(mapId, { doubleClickZoom: false }).setView([lat, lon], 12);
    // SVG renderer is managed by MapComponent

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    const materialIcon = L.divIcon({
      html: '<span class="material-icons" style="font-size: 32px; color: #2196f3;">place</span>',
      className: 'custom-material-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
    this.currentLocationMarker = L.marker([lat, lon], {
      icon: materialIcon,
    }).addTo(this.map);

    // No special pane needed: main radius will draw in overlayPane

    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    ensureStripedPattern(svg, 'airportStripedPattern', 'cyan', 0.5);
    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
    ).addTo(this.map);

    this.map.on('dblclick', (event: L.LeafletMouseEvent) => {
      onDblClick(event.latlng.lat, event.latlng.lng);
    });

    return this.map;
  }

  /**
   * Set MapService map when created externally
   */
  setMapInstance(map: L.Map): void {
    this.map = map;
    // SVG renderer is managed by MapComponent
  }

  // Main search radius
  setMainRadius(lat: number, lon: number, radiusKm: number): void {
    // Draw main radius in overlayPane for proper map transforms
    if (this.mainRadiusCircle) {
      this.map.removeLayer(this.mainRadiusCircle);
    }
    this.mainRadiusCircle = L.circle([lat, lon], {
      // render in default overlayPane
      pane: 'overlayPane',
      radius: radiusKm * 1000,
      color: 'white',
      weight: 2,
      className: 'main-radius-circle',
      fill: true,
      fillColor: 'rgba(0, 0, 0, 1)', // white semi-transparent for visibility
      fillOpacity: 0.3,
    }).addTo(this.map);
    // Bring to back so other overlays render above
    this.mainRadiusCircle.bringToBack();
    // Insert the circle's group at the bottom of overlayPane SVG to ensure it is behind all other paths
    try {
      const pathEl = (this.mainRadiusCircle as any)._path as SVGElement;
      const group = pathEl.parentNode as SVGGElement;
      const svg = this.map
        .getPanes()
        .overlayPane.querySelector('svg') as SVGSVGElement;
      if (svg && group) {
        svg.insertBefore(group, svg.firstChild);
        console.log(
          '[MapService] main radius group prepended to overlayPane SVG'
        );
      }
    } catch (e) {
      console.warn('[MapService] failed to prepend main radius group', e);
    }

    // Optional: re-draw on view changes to stay centered
    this.map.on('moveend viewreset zoomend', () => {
      this.mainRadiusCircle?.bringToBack();
    });
  }

  removeMainRadius(): void {
    if (this.mainRadiusCircle) {
      this.map.removeLayer(this.mainRadiusCircle);
      this.mainRadiusCircle = undefined;
    }
  }

  // Airport circles management
  addAirportCircle(
    id: number,
    coords: [number, number],
    radiusKm: number
  ): void {
    // avoid duplicates
    if (this.airportCircles.has(id)) {
      return;
    }
    const circle = L.circle(coords, {
      radius: radiusKm * 1000,
      color: 'cyan',
      weight: 2,
      fill: true,
      fillColor: 'url(#airportStripedPattern)',
      fillOpacity: 0.8,
      interactive: false,
    }).addTo(this.map);
    // ensure pattern
    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    ensureStripedPattern(svg, 'airportStripedPattern', 'cyan', 0.5);
    this.airportCircles.set(id, circle);
  }

  removeAirportCircle(id: number): void {
    const circle = this.airportCircles.get(id);
    if (circle) {
      this.map.removeLayer(circle);
      this.airportCircles.delete(id);
    }
  }

  clearAirportCircles(): void {
    this.airportCircles.forEach((circle) => this.map.removeLayer(circle));
    this.airportCircles.clear();
  }

  // Retrieve all airport circles
  getAirportCircles(): L.Circle[] {
    return Array.from(this.airportCircles.values());
  }

  setCurrentLocationMarker(lat: number, lon: number) {
    if (this.currentLocationMarker) {
      this.currentLocationMarker.setLatLng([lat, lon]);
    }
  }

  addHouseMarker(lat: number, lon: number) {
    if (!this.map) return;
    const houseIcon = L.divIcon({
      html: '<span class="material-icons" style="font-size: 32px; color: #ff5722;">home</span>',
      className: 'custom-house-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
    L.marker([lat, lon], { icon: houseIcon })
      .addTo(this.map)
      .bindPopup('Your Current Location');
  }

  setView(lat: number, lon: number, zoom?: number) {
    if (this.map) {
      this.map.setView([lat, lon], zoom ?? this.map.getZoom());
    }
  }

  getMap(): L.Map | undefined {
    return this.map;
  }

  hideCurrentLocationMarker(): void {
    if (this.currentLocationMarker) {
      this.map.removeLayer(this.currentLocationMarker);
    }
  }

  showCurrentLocationMarker(): void {
    if (
      this.currentLocationMarker &&
      !this.map.hasLayer(this.currentLocationMarker)
    ) {
      this.currentLocationMarker.addTo(this.map);
    }
  }
}
