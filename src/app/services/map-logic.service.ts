import { Injectable } from '@angular/core';
import { PlaneModel } from '../models/plane-model';
import { PlaneLogService } from './plane-log.service';
import { haversineDistance } from '../utils/geo-utils';

@Injectable({ providedIn: 'root' })
export class MapLogicService {
  constructor(
    private planeLogService: PlaneLogService
  ) // Intentionally keep plane classification on PlaneModel to avoid
  // map/list divergence (do not recompute from AircraftDbService here).
  {}

  processPlanes(
    planes: PlaneModel[],
    exclude: boolean,
    defaultCoords: [number, number],
    airportRadiusKm: number
  ) {
    // Filtering and sorting logic from updatePlaneLog
    const planesToShow = exclude
      ? planes.filter((plane) => !plane.filteredOut)
      : planes;

    const sortByMilitary = (a: PlaneModel, b: PlaneModel) => {
      const aIsMilitary = a.isMilitary === true;
      const bIsMilitary = b.isMilitary === true;
      if (aIsMilitary !== bIsMilitary) return aIsMilitary ? -1 : 1;
      return b.firstSeen - a.firstSeen || a.icao.localeCompare(b.icao);
    };

    const sky = planesToShow.filter(
      (entry) =>
        entry.lat != null &&
        entry.lon != null &&
        haversineDistance(
          defaultCoords[0],
          defaultCoords[1],
          entry.lat!,
          entry.lon!
        ) > airportRadiusKm
    );
    sky.sort(sortByMilitary);

    const airport = planesToShow.filter(
      (entry) =>
        entry.lat != null &&
        entry.lon != null &&
        haversineDistance(
          defaultCoords[0],
          defaultCoords[1],
          entry.lat!,
          entry.lon!
        ) <= airportRadiusKm
    );
    airport.sort(sortByMilitary);

    // For historical log, always respect filteredOut property
    const mergedMap = new Map<string, PlaneModel>();
    for (const plane of this.planeLogService.getHistoricalLog()) {
      mergedMap.set(plane.icao, plane);
    }
    for (const plane of planes) {
      mergedMap.set(plane.icao, plane);
    }
    let seenPlanes = Array.from(mergedMap.values());
    if (exclude) {
      seenPlanes = seenPlanes.filter((plane) => !plane.filteredOut);
    }
    this.planeLogService.updateHistoricalLog(seenPlanes);
    this.planeLogService.getHistoricalLog().sort((a, b) => {
      if (a.isMilitary !== b.isMilitary) {
        return a.isMilitary ? -1 : 1;
      }
      if (a.isNew !== b.isNew) {
        return a.isNew ? -1 : 1;
      }
      return a.firstSeen - b.firstSeen || a.icao.localeCompare(b.icao);
    });
    return {
      sky,
      airport,
      seen: this.planeLogService.getHistoricalLog().slice(),
    };
  }
}
