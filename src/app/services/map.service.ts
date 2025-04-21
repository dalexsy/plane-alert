import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { ensureStripedPattern } from '../utils/svg-utils';

@Injectable({ providedIn: 'root' })
export class MapService {
  private map!: L.Map;
  private currentLocationMarker!: L.Marker;
  private airportCircle!: L.Circle;

  initializeMap(
    mapId: string,
    lat: number,
    lon: number,
    airportCoords: [number, number],
    airportRadiusKm: number,
    onDblClick: (lat: number, lon: number) => void
  ): L.Map {
    this.map = L.map(mapId, { doubleClickZoom: false }).setView([lat, lon], 12);
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

    this.airportCircle = L.circle(airportCoords, {
      radius: airportRadiusKm * 1000,
      color: 'cyan',
      weight: 2,
      fill: true,
      fillColor: 'url(#airportStripedPattern)',
      fillOpacity: 0.8,
    }).addTo(this.map);

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
