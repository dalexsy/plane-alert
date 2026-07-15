import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import type { PlaneModel } from '../../models/plane-model';
import type { DistanceUnit } from '../../utils/units/units.util';
import type { PlaneDataService } from '../plane-data/plane-data.service';
import type { PlaneVisualizationService } from '../plane-visualization/plane-visualization.service';
import type { PathCalculationService } from '../path-calculation/path-calculation.service';
import type { SettingsService } from '../settings/settings.service';

export function processPlaneFinderAircraft(params: {
  aircraftData: unknown[];
  map: L.Map;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  excludeDiscount: boolean;
  blockedPrefixes: string[];
  isInitialLoad: boolean;
  getAircraftInfo: (
    icao: string
  ) => { model?: string; ownop?: string; mil?: boolean } | null;
  previousLog: Map<string, PlaneModel>;
  onNewPlane: () => void;
  getFlagHTML: (origin: string) => string;
  planeDataService: PlaneDataService;
  planeVisualizationService: PlaneVisualizationService;
  pathCalculationService: PathCalculationService;
  settings: SettingsService;
}): { anyNew: boolean; currentIDs: string[]; updatedLog: PlaneModel[] } {
  const {
    aircraftData,
    map,
    centerLat,
    centerLon,
    radiusKm,
    excludeDiscount,
    blockedPrefixes,
    isInitialLoad,
    getAircraftInfo,
    previousLog,
    onNewPlane,
    getFlagHTML,
    planeDataService,
    planeVisualizationService,
    pathCalculationService,
    settings,
  } = params;

  const currentUpdateSet = new Set<string>();
  const updatedLogModels: PlaneModel[] = [];
  let anyNew = false;

  for (const ac of aircraftData) {
    const processedData = planeDataService.processAircraftData(
      ac,
      centerLat,
      centerLon,
      radiusKm,
      excludeDiscount,
      blockedPrefixes,
      isInitialLoad,
      getAircraftInfo
    );
    if (!processedData) continue;

    currentUpdateSet.add(processedData.id);
    if (processedData.isNew && !processedData.isFiltered) {
      anyNew = true;
      onNewPlane();
    }

    const { planeModel, isExisting } = planeDataService.createOrUpdatePlaneModel(
      processedData,
      previousLog,
      centerLat,
      centerLon
    );

    if (processedData.isFiltered) {
      if (planeModel.marker) {
        planeVisualizationService.removePlaneVisuals(planeModel, map);
      }
      updatedLogModels.push(planeModel);
      continue;
    }

    const userUnit = settings.distanceUnit as DistanceUnit;
    // Seed previous ADS-B from history so onion-skin has a prior fix after throttle
    if (planeModel.marker && planeModel.positionHistory?.length >= 2) {
      const prev =
        planeModel.positionHistory[planeModel.positionHistory.length - 2];
      (planeModel.marker as any).__paLastAdsB = {
        lat: prev.lat,
        lon: prev.lon,
      };
    } else if (planeModel.marker && planeModel.lat != null && planeModel.lon != null) {
      // Before model lat/lon were overwritten, createOrUpdate already assigned new lat —
      // use marker latlng as previous when history is thin
      const cur = planeModel.marker.getLatLng();
      if (
        Math.abs(cur.lat - processedData.lat) > 1e-6 ||
        Math.abs(cur.lng - processedData.lon) > 1e-6
      ) {
        (planeModel.marker as any).__paLastAdsB = {
          lat: cur.lat,
          lon: cur.lng,
        };
      }
    }
    const marker = planeVisualizationService.createPlaneMarker(
      planeModel,
      map,
      processedData.lat,
      processedData.lon,
      processedData.track ?? 0,
      processedData.altitude,
      processedData.onGround,
      processedData.isNew,
      processedData.isMilitary,
      processedData.isSpecial,
      processedData.isUnknown,
      processedData.model,
      processedData.id,
      processedData.callsign,
      getFlagHTML,
      userUnit,
      centerLat,
      centerLon
    );
    planeModel.marker = marker;

    pathCalculationService.updatePlanePath(
      map,
      planeModel,
      processedData.lat,
      processedData.lon,
      processedData.track ?? 0,
      processedData.velocity,
      processedData.altitude,
      processedData.onGround
    );
    pathCalculationService.updateHistoricalTrail(
      map,
      planeModel,
      processedData.lat,
      processedData.lon,
      processedData.altitude,
      processedData.onGround
    );
    updatedLogModels.push(planeModel);
  }

  planeDataService.updateNewPlaneService(currentUpdateSet);
  return {
    anyNew,
    currentIDs: Array.from(currentUpdateSet),
    updatedLog: updatedLogModels,
  };
}

export function wirePlaneFinderMap(
  map: L.Map,
  centerLat: number,
  centerLon: number,
  settings: SettingsService
): void {
  map.setView(
    [settings.mapLat ?? centerLat, settings.mapLon ?? centerLon],
    settings.mapZoom
  );
  map.on('moveend', () => {
    const c = map.getCenter();
    settings.setMapLat(c.lat);
    settings.setMapLon(c.lng);
  });
  map.on('zoomend', () => {
    settings.setMapZoom(map.getZoom());
  });
}
