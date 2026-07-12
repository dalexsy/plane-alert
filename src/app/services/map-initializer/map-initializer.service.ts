import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { ensureStripedPattern } from '../../utils/svg-utils/svg-utils';
import { MapService } from '../map/map.service';
import { MapThemeService } from '../map-theme/map-theme.service';
import { SkyOverlayService } from '../sky-overlay/sky-overlay.service';
import { WeatherOverlayService } from '../weather-overlay/weather-overlay.service';

@Injectable({
  providedIn: 'root',
})
export class MapInitializerService {
  constructor(
    private mapService: MapService,
    private mapThemeService: MapThemeService,
    private skyOverlayService: SkyOverlayService,
    private weatherOverlayService: WeatherOverlayService
  ) {}

  /**
   * Initialize the map with all necessary layers and configurations
   */
  initializeMap(
    mapId: string,
    lat: number,
    lon: number,
    radius: number,
    onDblClick: (lat: number, lon: number) => void
  ): { map: L.Map; currentLocationMarker: L.Marker } {
    const map = L.map(mapId, {
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    }).setView([lat, lon], 12);

    // Disable CD for frequent panning events, only toggle class inside Angular when needed
    map.on('movestart', () => {
      // This will be handled by the component
    });
    map.on('moveend', () => {
      // This will be handled by the component
    });

    // Add SVG renderer for vector overlays (draws into overlayPane)
    L.svg().addTo(map);

    // Create a custom pane for followed markers and set its zIndex above markerPane
    map.createPane('followedMarkerPane');
    const followedPane = map.getPane('followedMarkerPane') as HTMLElement;
    followedPane.style.zIndex = '610';
    followedPane.style.pointerEvents = 'auto';

    // Define airport striped patterns in overlayPane's SVG
    const overlaySvg = map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement | null;
    if (overlaySvg) {
      ensureStripedPattern(
        overlaySvg,
        'airportStripedPatternCyan',
        'cyan',
        1.0
      );
      ensureStripedPattern(
        overlaySvg,
        'airportStripedPatternGold',
        'gold',
        1.0
      );
    }

    // Initialize map themes (replaces hardcoded tile layers)
    this.mapThemeService.initializeWithMap(map);

    // Initialize weather layers
    this.weatherOverlayService.initializeWithMap(map);

    // Initialize sky overlay service after all panes are created
    this.skyOverlayService.initialize(map);

    // Create custom marker for current location
    const locationIcon = L.divIcon({
      className: 'current-location-marker',
      html: '<span class="material-symbols-outlined">location_on</span>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    const currentLocationMarker = L.marker([lat, lon], {
      icon: locationIcon,
    }).addTo(map);

    // Set up double-click handler
    map.on('dblclick', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      onDblClick(lat, lng);
    });

    // Set the map instance in the service
    this.mapService.setMapInstance(map);

    return { map, currentLocationMarker };
  }

  /**
   * Initialize home marker if home location exists
   */
  initializeHomeMarker(
    homeLocation: { lat: number; lon: number } | null
  ): L.Marker | null {
    if (!homeLocation) return null;

    const map = this.mapService.getMap();
    if (!map) return null;

    // Create custom home icon
    const homeIcon = L.divIcon({
      className: 'home-marker',
      html: '<span class="material-symbols-outlined">home</span>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    // Add home marker
    return L.marker([homeLocation.lat, homeLocation.lon], {
      icon: homeIcon,
    }).addTo(map);
  }

  /**
   * Update markers visibility based on current location
   */
  updateMarkersVisibility(
    currentLat: number,
    currentLon: number,
    homeLocation: { lat: number; lon: number } | null,
    currentLocationMarker: L.Marker,
    homeMarker: L.Marker | null
  ): void {
    if (!homeLocation) return;

    // If we're at the home location (within a small tolerance)
    const atHome =
      Math.abs(currentLat - homeLocation.lat) < 0.0001 &&
      Math.abs(currentLon - homeLocation.lon) < 0.0001;

    if (atHome && currentLocationMarker) {
      currentLocationMarker.remove();
    } else if (
      !atHome &&
      currentLocationMarker &&
      !this.mapService.getMap()?.hasLayer(currentLocationMarker)
    ) {
      currentLocationMarker.addTo(this.mapService.getMap()!);
    }
  }
}
