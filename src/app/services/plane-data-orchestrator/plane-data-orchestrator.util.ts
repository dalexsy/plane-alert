import { PlaneModel } from '../../models/plane-model';
import { PlaneFilterService } from '../plane-filter.service';
import { SettingsService } from '../settings.service';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasPlaneDataChanged(existing: PlaneModel, updated: PlaneModel): boolean {
  return (
    existing.lat !== updated.lat ||
    existing.lon !== updated.lon ||
    existing.altitude !== updated.altitude ||
    existing.track !== updated.track ||
    existing.velocity !== updated.velocity ||
    existing.onGround !== updated.onGround
  );
}

export function filterActivePlanes(
  planes: PlaneModel[],
  planeFilter: PlaneFilterService,
  settings: SettingsService
): { filteredPlanes: PlaneModel[]; activePlanes: PlaneModel[] } {
  const filteredPlanes = planes.filter((plane) =>
    planeFilter.shouldIncludeCallsign(
      plane.callsign,
      settings.excludeDiscount,
      planeFilter.getFilterPrefixes(),
      plane.isMilitary || false
    )
  );
  const activePlanes = filteredPlanes.filter((plane) => !plane.filteredOut && plane.lat != null && plane.lon != null);
  return { filteredPlanes, activePlanes };
}
