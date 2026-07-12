import { SettingsService } from '../settings/settings.service';

export function mapCurrentLat(
  settings: SettingsService,
  defaultCoords: [number, number]
): number {
  return settings.lat ?? defaultCoords[0];
}

export function mapCurrentLon(
  settings: SettingsService,
  defaultCoords: [number, number]
): number {
  return settings.lon ?? defaultCoords[1];
}

export function mapRadiusKm(settings: SettingsService): number {
  return settings.radius ?? 5;
}

export function mapHomeLocationValue(
  settings: SettingsService
): { lat: number; lon: number } | null {
  return settings.getHomeLocation() || null;
}

export function mapIsAtHome(
  settings: SettingsService,
  defaultCoords: [number, number]
): boolean {
  const home = settings.getHomeLocation();
  if (!home) return false;
  const lat = settings.lat ?? defaultCoords[0];
  const lon = settings.lon ?? defaultCoords[1];
  const tol = 1e-6;
  return Math.abs(lat - home.lat) < tol && Math.abs(lon - home.lon) < tol;
}
