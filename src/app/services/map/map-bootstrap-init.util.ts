import type { ChangeDetectorRef } from '@angular/core';
import type { MapRuntimeService } from './map-runtime.service';
import type { MapPlaneOperationsService } from './map-plane-operations.service';
import type { SettingsService } from '../settings/settings.service';
import type { LocationContextService } from '../location-context/location-context.service';
import type { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import type { MapInitializerService } from '../map-initializer/map-initializer.service';
import type { AirportService } from '../airport/airport.service';
import type { WeatherOverlayService } from '../weather-overlay/weather-overlay.service';
import type { MapService } from './map.service';
import type { MapWeatherUiService } from './map-weather-ui.service';
import type { ScanService } from '../scan/scan.service';
import type { MapOverlayStateService } from './map-overlay-state.service';
import type { UiStateService } from '../ui-state/ui-state.service';
import type { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';

export interface MapBootstrapMapInitResult {
  startLat: number;
  startLon: number;
  radius: number;
  lat: number;
  lon: number;
}

export async function initializeMapForBootstrap(deps: {
  runtime: MapRuntimeService;
  settings: SettingsService;
  mapInitializerService: MapInitializerService;
  planeOps: MapPlaneOperationsService;
  locationContext: LocationContextService;
  scanService: ScanService;
  airportService: AirportService;
  weatherOverlayService: WeatherOverlayService;
  mapService: MapService;
  weatherUi: MapWeatherUiService;
  geocodingCache: GeocodingCacheService;
  overlay: MapOverlayStateService;
  uiState: UiStateService;
  inputOverlayComponent: InputOverlayComponent;
  cdr: ChangeDetectorRef;
}): Promise<MapBootstrapMapInitResult> {
  const {
    runtime,
    settings,
    mapInitializerService,
    planeOps,
    locationContext,
    scanService,
    airportService,
    weatherOverlayService,
    mapService,
    weatherUi,
    geocodingCache,
    overlay,
    uiState,
    inputOverlayComponent,
    cdr,
  } = deps;

  const lat = settings.lat ?? runtime.DEFAULT_COORDS[0];
  const lon = settings.lon ?? runtime.DEFAULT_COORDS[1];
  const radius = settings.radius ?? 5;

  const homeLoc = settings.getHomeLocation();
  let startLat = lat;
  let startLon = lon;
  if (settings.lat === null && settings.lon === null && homeLoc) {
    startLat = homeLoc.lat;
    startLon = homeLoc.lon;
  }

  const storedExclude = localStorage.getItem('excludeDiscount');
  if (storedExclude !== null) {
    settings.excludeDiscount = storedExclude === 'true';
  }

  runtime.isProgrammaticMove = true;
  const { map, currentLocationMarker } = mapInitializerService.initializeMap(
    'map',
    startLat,
    startLon,
    radius,
    (dblLat, dblLng) => {
      const currentMainRadius = settings.radius ?? 5;
      const placeholderAddress = `${dblLat.toFixed(4)}, ${dblLng.toFixed(4)}`;
      settings.setLocationWithAddress(dblLat, dblLng, placeholderAddress);
      planeOps.updateMap(inputOverlayComponent, dblLat, dblLng, currentMainRadius);
      planeOps.reverseGeocode(dblLat, dblLng).then((address) => {
        locationContext.setLocation(dblLat, dblLng, address, 'address');
        settings.setLocationWithAddress(dblLat, dblLng, address);
      });
      scanService.forceScan();
    }
  );
  runtime.map = map;
  runtime.currentLocationMarker = currentLocationMarker;
  map.invalidateSize();
  requestAnimationFrame(() => map.invalidateSize());

  runtime.map.on('moveend', () => {
    runtime.isProgrammaticMove = false;
  });

  locationContext.currentLocation$.subscribe((locationData) => {
    if (
      locationData.source === 'address' &&
      locationData.lat !== undefined &&
      locationData.lon !== undefined
    ) {
      const r = settings.radius ?? 5;
      planeOps.updateMap(inputOverlayComponent, locationData.lat, locationData.lon, r);
    }
  });

  airportService.initialize(runtime.map);
  airportService.setClickedAirports(overlay.clickedAirports);
  weatherOverlayService.setCloudCoverVisible(settings.showCloudCover);
  weatherOverlayService.setRainCoverVisible(settings.showRainCover);
  weatherUi.toggleConeVisibility(uiState.coneVisible, cdr);
  mapService.setMapInstance(runtime.map);
  cdr.detectChanges();
  await planeOps.updateMap(inputOverlayComponent, startLat, startLon, radius);
  geocodingCache.clearCache();

  return { startLat, startLon, radius, lat, lon };
}
