#!/usr/bin/env node
/**
 * Builds map services from extracted chunks and writes a thin MapComponent shell.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'src/app/services/map/_extracted');
const SVC = join(ROOT, 'src/app/services/map');

function read(name) {
  return readFileSync(join(EXT, `${name}.txt`), 'utf8');
}

function xform(body, extra = {}) {
  let s = body;
  const reps = {
    'this.map': 'this.runtime.map',
    'this.planeLog': 'this.runtime.planeLog',
    'this.planeHistoricalLog': 'this.runtime.planeHistoricalLog',
    'this.planeNewTimestamps': 'this.runtime.planeNewTimestamps',
    'this.currentLocationMarker': 'this.runtime.currentLocationMarker',
    'this.homeMarker': 'this.runtime.homeMarker',
    'this.isProgrammaticMove': 'this.runtime.isProgrammaticMove',
    'this.cloudLayer': 'this.runtime.cloudLayer',
    'this.rainLayer': 'this.runtime.rainLayer',
    'this.manualUpdate': 'this.runtime.manualUpdate',
    'this.locationErrorShown': 'this.runtime.locationErrorShown',
    'this.currentFaviconUrl': 'this.runtime.currentFaviconUrl',
    'this.isProcessingFollowRequest': 'this.runtime.isProcessingFollowRequest',
    'this.globalTooltipClickHandler': 'this.runtime.globalTooltipClickHandler',
    'this.svgPatternRetryTimeout': 'this.runtime.svgPatternRetryTimeout',
    'this.viewConesConfig': 'this.runtime.viewConesConfig',
    'this.showConeConfigEditor': 'this.runtime.showConeConfigEditor',
    'this.centerZoom': 'this.runtime.centerZoom',
    'this.isResizing': 'this.runtime.isResizing',
    'this.resizeTimeout': 'this.runtime.resizeTimeout',
    'this.clickedAirports': 'this.overlay.clickedAirports',
    'this.airportCircles': 'this.overlay.airportCircles',
    'this.activePlaneIcaos': 'this.overlay.activePlaneIcaos',
    'this.highlightedPlaneIcao': 'this.overlay.highlightedPlaneIcao',
    'this.followNearest': 'this.overlay.followNearest',
    'this.closestPlane': 'this.overlay.closestPlane',
    'this.closestDistance': 'this.overlay.closestDistance',
    'this.closestOperator': 'this.overlay.closestOperator',
    'this.closestSecondsAway': 'this.overlay.closestSecondsAway',
    'this.closestVelocity': 'this.overlay.closestVelocity',
    'this.locationStreet': 'this.overlay.locationStreet',
    'this.locationDistrict': 'this.overlay.locationDistrict',
    'this.skyPlaneLog': 'this.overlay.skyPlaneLog',
    'this.airportPlaneLog': 'this.overlay.airportPlaneLog',
    'this.seenPlaneLog': 'this.overlay.seenPlaneLog',
    'this.windowViewPlanes': 'this.overlay.windowViewPlanes',
    'this.windSpeed': 'this.runtime.windSpeed',
    'this.windAngle': 'this.runtime.windAngle',
    'this.windStat': 'this.runtime.windStat',
    'this.DEFAULT_COORDS': 'this.runtime.DEFAULT_COORDS',
    'this.showDateTime': 'this.uiState.showDateTime',
    'this.animationsEnabled': 'this.uiState.animationsEnabled',
    'this.showAirportLabels': 'this.uiState.showAirportLabels',
    'this.addressLooksWrongForCoordinates': 'addressLooksWrongForCoordinates',
    'this.applySkyColorsToCloudLayer': 'this.cloudFilter.applySkyColorsToCloudLayer',
    'this.handleFollowStateChange': 'this.followHandlers.handleFollowStateChange',
    'this.handleFollowRequest': 'this.followHandlers.handleFollowRequest',
    'this.updateMap': 'this.planeOps.updateMap',
    'this.reverseGeocode': 'this.planeOps.reverseGeocode',
    'this.findPlanes': 'this.planeOps.findPlanes',
    'this.removeOutOfRangePlanes': 'this.planeOps.removeOutOfRangePlanes',
    'this.toggleConeVisibility': 'this.weatherUi.toggleConeVisibility',
    'this.unhighlightPlane': 'this.planeInteract.unhighlightPlane',
    'this.centerOnPlane': 'this.planeInteract.centerOnPlane',
    'this.setHomeMarker': 'this.homeNav.setHomeMarker',
    'this.updateFavicon': 'this.planeOps.updateFavicon',
    'this.planeLogService.setMapComponent(this)': 'this.planeLogService.setOverlayState(this.overlay)',
    ...extra,
  };
  for (const [from, to] of Object.entries(reps)) {
    s = s.split(from).join(to);
  }
  return s;
}

const ctxType = `export interface MapHostRefs {
  inputOverlayComponent: InputOverlayComponent;
  resultsOverlayComponent: ResultsOverlayComponent;
  windowViewOverlayComponent: WindowViewOverlayComponent;
  cdr: ChangeDetectorRef;
}`;

const commonImports = `import { Injectable, ChangeDetectorRef, NgZone, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { haversineDistance } from '../../utils/geo-utils';
import { PlaneModel } from '../../models/plane-model';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapCloudLayerFilterService } from './map-cloud-layer-filter.service';
import { addressLooksWrongForCoordinates } from './map-address-sync.util';
`;

// --- map-event-registration.service.ts ---
const eventReg = `${commonImports}
import { FollowCoordinatorService } from '../follow-coordinator.service';
import { PlaneFollowService } from '../plane-follow.service';
import { GeocodingCacheService } from '../geocoding-cache.service';

${ctxType}

@Injectable({ providedIn: 'root' })
export class MapEventRegistrationService {
  constructor(
    private ngZone: NgZone,
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private specialListService: SpecialListService,
    private followCoordinatorService: FollowCoordinatorService,
    private planeLog: Map<string, PlaneModel>,
    private geocodingCache: GeocodingCacheService
  ) {}

  registerConstructorListeners(refs: MapHostRefs): void {
    const { cdr } = refs;
    this.specialListService.specialListUpdated$.subscribe(() => {
      this.runtime.planeLog.forEach((plane) => {
        const tooltipEl = plane.marker?.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.classList.toggle(
            'special-plane-tooltip',
            this.specialListService.isSpecial(plane.icao)
          );
        }
        const markerEl = plane.marker?.getElement();
        if (markerEl) {
          markerEl.classList.toggle(
            'special-plane',
            this.specialListService.isSpecial(plane.icao)
          );
        }
      });
    });

    window.addEventListener('plane-tooltip-follow', (e: Event) => {
      const icao = (e as CustomEvent).detail?.icao;
      if (!icao) return;
      this.ngZone.run(() => {
        if (this.overlay.highlightedPlaneIcao === icao) {
          this.followCoordinatorService.clearAllModes();
        } else {
          const pm = this.runtime.planeLog.get(icao);
          if (pm) {
            this.followCoordinatorService.followPlaneManually(pm as any);
            if (pm.lat != null && pm.lon != null) {
              this.runtime.map.panTo([pm.lat, pm.lon], {
                animate: true,
                duration: 1.0,
              });
              this.geocodingCache.reverseGeocode(pm.lat, pm.lon).then((address) => {
                this.overlay.locationDistrict = address;
                cdr.detectChanges();
              });
            }
          }
        }
      });
    });
  }
}
`.replace(
  'private planeLog: Map<string, PlaneModel>',
  'private specialListService: import("../special-list.service").SpecialListService'
);

writeFileSync(join(SVC, 'map-event-registration.service.ts'), eventReg);

console.log('Generated map-event-registration.service.ts');
