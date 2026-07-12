import { Injectable, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import { PlaneModel } from '../../models/plane-model';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapUpdateService } from '../map-update/map-update.service';
import { BrightnessService } from '../brightness/brightness.service';
import { GeocodingCacheService } from '../geocoding-cache/geocoding-cache.service';
import { PlaneUpdateService } from '../plane-update/plane-update.service';
import { PlaneLogService } from '../plane-log/plane-log.service';
import { ClosestPlaneService } from '../closest-plane/closest-plane.service';
import { PlaneFilterService } from '../plane-filter/plane-filter.service';

@Injectable({ providedIn: 'root' })
export class MapPlaneOperationsService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private mapUpdate: MapUpdateService,
    private brightnessService: BrightnessService,
    private geocodingCache: GeocodingCacheService,
    private planeUpdate: PlaneUpdateService,
    private planeLogService: PlaneLogService,
    private closestPlaneService: ClosestPlaneService,
    private planeFilter: PlaneFilterService
  ) {}

  async updateMap(
    inputOverlayComponent: InputOverlayComponent,
    lat: number,
    lon: number,
    radiusKm?: number,
    zoomLevel?: number
  ): Promise<void> {
    this.runtime.isProgrammaticMove = true;
    await this.mapUpdate.updateMap(
      this.runtime.map,
      this.runtime.currentLocationMarker,
      this.runtime.homeMarker,
      inputOverlayComponent,
      this.runtime.planeLog,
      this.runtime.planeHistoricalLog,
      lat,
      lon,
      radiusKm,
      zoomLevel
    );
    this.brightnessService.setLocation(lat, lon);
  }

  removeOutOfRangePlanes(lat: number, lon: number, radius: number): void {
    for (const [icao, plane] of this.runtime.planeLog.entries()) {
      if (
        plane.lat == null ||
        plane.lon == null ||
        haversineDistance(lat, lon, plane.lat, plane.lon) > radius
      ) {
        plane.removeVisuals(this.runtime.map);
        this.runtime.planeLog.delete(icao);
      }
    }
    this.overlay.activePlaneIcaos = new Set(this.runtime.planeLog.keys());
    this.runtime.planeHistoricalLog = this.planeLogService.updatePlaneLog(
      Array.from(this.runtime.planeLog.values())
    );
  }

  reverseGeocode(lat: number, lon: number): Promise<string> {
    return this.geocodingCache.reverseGeocode(lat, lon);
  }

  findPlanes(inputOverlayComponent: InputOverlayComponent, cdr: ChangeDetectorRef): void {
    if (inputOverlayComponent) {
      inputOverlayComponent.lastScanTime = new Date();
    }

    this.planeUpdate
      .findPlanes(
        this.runtime.map,
        this.runtime.planeLog,
        this.runtime.planeHistoricalLog,
        this.runtime.planeNewTimestamps,
        this.overlay.activePlaneIcaos,
        this.overlay.highlightedPlaneIcao,
        this.overlay.followNearest,
        cdr
      )
      .then(({ faviconUrl }) => {
        if (faviconUrl) {
          this.updateFavicon(faviconUrl);
        }
        this.closestPlaneService.computeClosestPlane(
          this.runtime.planeLog as Map<string, PlaneModel>,
          this.overlay.highlightedPlaneIcao
        );
        const closestData = this.closestPlaneService.getClosestPlaneData();
        this.overlay.closestPlane = closestData.closestPlane;
        this.overlay.closestDistance = closestData.closestDistance;
        this.overlay.closestOperator = closestData.closestOperator;
        this.overlay.closestSecondsAway = closestData.closestSecondsAway;
        this.overlay.closestVelocity = closestData.closestVelocity;
        this.overlay.locationStreet = closestData.locationStreet;
        this.overlay.locationDistrict = closestData.locationDistrict;
        this.runtime.manualUpdate = false;
      })
      .catch(() => undefined);
  }

  updateFavicon(iconUrl: string): void {
    if (this.runtime.currentFaviconUrl === iconUrl) return;
    this.runtime.currentFaviconUrl = iconUrl;
    const linkSelectors = [
      "link[rel='icon']",
      "link[rel='shortcut icon']",
    ].join(',');
    const links =
      this.document.querySelectorAll<HTMLLinkElement>(linkSelectors);
    links.forEach((link) => {
      link.href = iconUrl;
    });
  }

  clearSeenList(
    resultsOverlayComponent: { seenPlaneLog: unknown[] },
    cdr: ChangeDetectorRef
  ): void {
    this.runtime.planeHistoricalLog = [];
    resultsOverlayComponent.seenPlaneLog = [];
    cdr.detectChanges();
  }

  exportFilterList(): void {
    const filters = this.planeFilter.getFilterPrefixes();
    localStorage.setItem('filterList', JSON.stringify(filters));
    const data = JSON.stringify(filters, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filter-list.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
