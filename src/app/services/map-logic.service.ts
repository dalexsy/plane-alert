import { Injectable } from '@angular/core';
import { PlaneModel } from '../models/plane-model';
import { PlaneLogService } from './plane-log.service';
import { PlaneFilterService } from './plane-filter.service';
import { AircraftDbService } from './aircraft-db.service';
import { haversineDistance } from '../utils/geo-utils';
import { playAlertSound } from '../utils/alert-sound';

@Injectable({ providedIn: 'root' })
export class MapLogicService {
  constructor(
    private planeLogService: PlaneLogService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService
  ) {}

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
      const aIsMilitary = this.aircraftDb.lookup(a.icao)?.mil || false;
      const bIsMilitary = this.aircraftDb.lookup(b.icao)?.mil || false;
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
    for (const plane of this.planeLogService.getHistoricalLog()) {
      plane.isMilitary = this.aircraftDb.lookup(plane.icao)?.mil || false;
    }
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

  handleFindPlanes(
    updatedLog: any[],
    previousPlaneKeys: Set<string>,
    previousFilteredStates: Map<string, boolean>,
    exclude: boolean,
    planeLog: Map<string, PlaneModel>,
    planeFilter: PlaneFilterService,
    aircraftDb: AircraftDbService
  ): PlaneModel[] {
    // Convert all planes to PlaneModel first
    const isPlaneModel = (p: any): p is PlaneModel =>
      p && typeof p.updateFrom === 'function';
    const updatedPlaneModels = updatedLog.map((p) =>
      isPlaneModel(p) ? p : new PlaneModel(p)
    );

    // DO NOT overwrite filteredOut here! Let UI/user actions control it.
    let visibleCount = 0;
    let filteredCount = 0;

    for (const planeModel of updatedPlaneModels) {
      // If it's in planeLog from the previous scan, it's not new now
      planeModel.isNew = !previousPlaneKeys.has(planeModel.icao);

      // Preserve filteredOut state from previous scan
      if (previousFilteredStates.has(planeModel.icao)) {
        planeModel.filteredOut = previousFilteredStates.get(planeModel.icao)!;
      } else {
        // For new planes, check if they should be filtered based on prefix
        if (exclude) {
          const prefix = planeFilter.extractAirlinePrefix(planeModel.callsign);
          const shouldBeFiltered = planeFilter
            .getFilterPrefixes()
            .includes(prefix);
          planeModel.filteredOut = shouldBeFiltered;
        } else {
          planeModel.filteredOut = false;
        }
      }

      // Count planes by visibility
      if (planeModel.filteredOut) {
        filteredCount++;
      } else {
        visibleCount++;
      }

      const isMilitary = aircraftDb.lookup(planeModel.icao)?.mil;
      if (planeModel.filteredOut) {
        planeModel.marker?.remove();
        planeModel.path?.remove();
      } else if (planeModel.marker) {
        if (planeModel.onGround) {
          planeModel.marker.getElement()?.classList.add('grounded-plane');
          planeModel.marker
            .getElement()
            ?.classList.remove('new-plane', 'military-plane');
          planeModel.marker
            .getTooltip()
            ?.getElement()
            ?.classList.remove('new-plane-tooltip', 'military-plane-tooltip');
        } else {
          if (isMilitary) {
            planeModel.marker.getElement()?.classList.add('military-plane');
            planeModel.marker.getElement()?.classList.remove('new-plane');
            planeModel.marker
              .getTooltip()
              ?.getElement()
              ?.classList.add('military-plane-tooltip');
            planeModel.marker
              .getTooltip()
              ?.getElement()
              ?.classList.remove('new-plane-tooltip');
          } else if (planeModel.isNew) {
            planeModel.marker.getElement()?.classList.add('new-plane');
            planeModel.marker.getElement()?.classList.remove('military-plane');
            planeModel.marker
              .getTooltip()
              ?.getElement()
              ?.classList.add('new-plane-tooltip');
            planeModel.marker
              .getTooltip()
              ?.getElement()
              ?.classList.remove('military-plane-tooltip');
          } else {
            planeModel.marker
              .getElement()
              ?.classList.remove('new-plane', 'military-plane');
            planeModel.marker
              .getTooltip()
              ?.getElement()
              ?.classList.remove('new-plane-tooltip', 'military-plane-tooltip');
          }
        }
      }
      planeLog.set(planeModel.icao, planeModel);
    }
    return updatedPlaneModels;
  }
}
