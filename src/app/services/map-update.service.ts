import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { SettingsService } from './settings.service';
import { MapService } from './map.service';
import { MapInitializerService } from './map-initializer.service';
import { AirportService } from './airport.service';
import { WindService } from './wind.service';
import { BrightnessService } from './brightness.service';
import { LocationContextService } from './location-context.service';
import { ScanService } from './scan.service';
import { GeocodingCacheService } from './geocoding-cache.service';
import { InputOverlayComponent } from '../components/input-overlay/input-overlay.component';
import { PlaneLogService } from './plane-log.service';
import { PlaneModel } from '../models/plane-model';
import { haversineDistance } from '../utils/geo-utils';

@Injectable({
  providedIn: 'root',
})
export class MapUpdateService {
  private _initialScanDone = false;

  constructor(
    private settings: SettingsService,
    private mapService: MapService,
    private mapInitializerService: MapInitializerService,
    private airportService: AirportService,
    private windService: WindService,
    private brightnessService: BrightnessService,
    private locationContextService: LocationContextService,
    private scanService: ScanService,
    private geocodingCache: GeocodingCacheService,
    private planeLogService: PlaneLogService
  ) {}

  /**
   * Central update function for map positioning and related services
   */
  async updateMap(
    map: L.Map,
    currentLocationMarker: L.Marker,
    homeMarker: L.Marker | null,
    inputOverlayComponent: InputOverlayComponent,
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    lat: number,
    lon: number,
    radiusKm?: number,
    zoomLevel?: number
  ): Promise<void> {
    // Clamp radius to a maximum of 500km
    let mainRadius = radiusKm ?? this.settings.radius ?? 5;
    if (mainRadius > 500) {
      mainRadius = 500;
    }

    // Update settings
    this.settings.setLat(lat);
    this.settings.setLon(lon);
    this.settings.setRadius(mainRadius);

    // Update map view
    const targetZoom = zoomLevel != null ? zoomLevel : map.getZoom();
    map.setView([lat, lon], targetZoom);

    // Draw main radius
    this.mapService.setMainRadius(lat, lon, mainRadius);

    // Update current marker position
    currentLocationMarker.setLatLng([lat, lon]);

    // Update markers visibility
    this.mapInitializerService.updateMarkersVisibility(
      lat,
      lon,
      this.settings.getHomeLocation(),
      currentLocationMarker,
      homeMarker
    );

    // Update input overlay if not collapsed
    if (!inputOverlayComponent.collapsed) {
      inputOverlayComponent.refreshDisplayValues();

      // Reverse geocode current center and update address input
      const addressInput = inputOverlayComponent.addressInputRef;
      if (addressInput) {
        try {
          const address = await this.geocodingCache.reverseGeocode(lat, lon);
          addressInput.setValue(address);
        } catch (error) {
          console.warn('Reverse geocoding failed:', error);
        }
      }
    }

    // Find airports and handle plane updates
    try {
      await this.airportService.findAndDisplayAirports(
        lat,
        lon,
        mainRadius,
        this.settings.showAirportLabels
      );

      // Remove out-of-range planes and handle scan
      this.removeOutOfRangePlanes(
        planeLog,
        planeHistoricalLog,
        lat,
        lon,
        mainRadius
      );

      // Prevent double scan on initial load
      if (!this._initialScanDone) {
        this._initialScanDone = true;
      } else {
        this.scanService.forceScan();
      }
    } catch (error) {
      console.warn('Airport search failed:', error);
    }

    // Update other services
    this.windService.fetchWindDirection(lat, lon);
    this.brightnessService.setLocation(lat, lon);
    this.locationContextService.updateFromMapCenter(lat, lon);
  }

  /**
   * Remove planes that are out of range
   */
  private removeOutOfRangePlanes(
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    lat: number,
    lon: number,
    radius: number
  ): void {
    for (const [icao, plane] of planeLog.entries()) {
      if (
        plane.lat == null ||
        plane.lon == null ||
        haversineDistance(lat, lon, plane.lat, plane.lon) > radius
      ) {
        plane.removeVisuals(this.mapService.getMap()!);
        planeLog.delete(icao);
      }
    }

    // Update active plane ICAOs and historical log
    planeHistoricalLog.length = 0;
    planeHistoricalLog.push(
      ...this.planeLogService.updatePlaneLog(Array.from(planeLog.values()))
    );
  }

  /**
   * Mark initial scan as done (used by component)
   */
  setInitialScanDone(done: boolean): void {
    this._initialScanDone = done;
  }
}
