import { PlaneModel, PositionHistory } from '../../models/plane-model';
import { planeTooltip } from '../../utils/tooltip/tooltip';
import {
  convertKmToTooltipDistance,
  convertAltitudeForTooltip,
  convertSpeedForTooltip,
  DistanceUnit,
} from '../../utils/units/units.util';
import type { AltitudeColorService } from '../altitude-color/altitude-color.service';

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function randomizeBrightness(): string {
  const brightness = 0.7 + Math.random() * 0.3;
  return `filter: brightness(${brightness.toFixed(2)});`;
}

export function computeExtraStyle(
  altitude: number | null,
  isGrounded: boolean,
  altitudeColor: AltitudeColorService
): string {
  if (isGrounded) return randomizeBrightness();
  if (altitude == null) return '';
  return `color: ${altitudeColor.getFillColor(altitude)};`;
}

export function calculateMovementDirection(
  positionHistory: PositionHistory[],
  currentLat: number,
  currentLon: number
): number | null {
  if (positionHistory.length < 2) return null;
  let previousPosition: PositionHistory | null = null;
  for (let i = positionHistory.length - 1; i >= 0; i--) {
    const position = positionHistory[i];
    if (position.lat && position.lon && Date.now() - position.timestamp <= 10 * 60 * 1000) {
      previousPosition = position;
      break;
    }
  }
  if (!previousPosition) return null;
  const latDiff = currentLat - previousPosition.lat;
  const lonDiff = currentLon - previousPosition.lon;
  if (Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) < 0.00001) return null;
  const lat1Rad = (previousPosition.lat * Math.PI) / 180;
  const lat2Rad = (currentLat * Math.PI) / 180;
  const deltaLonRad = ((currentLon - previousPosition.lon) * Math.PI) / 180;
  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function determineTrackForMarker(
  track: number | null,
  onGround: boolean,
  positionHistory: PositionHistory[],
  lat: number,
  lon: number
): number {
  if (!onGround) return track ?? 0;
  if (typeof track === 'number') return track;
  let lastKnownTrack: number | undefined;
  for (let i = positionHistory.length - 1; i >= 0; i--) {
    const histTrack = positionHistory[i].track;
    if (typeof histTrack === 'number') {
      lastKnownTrack = histTrack;
      break;
    }
  }
  if (lastKnownTrack === undefined && positionHistory.length >= 2) {
    const calculated = calculateMovementDirection(positionHistory, lat, lon);
    if (calculated !== null) lastKnownTrack = calculated;
  }
  return lastKnownTrack ?? 0;
}

export function buildPlaneTooltipHtml(
  plane: PlaneModel,
  userUnit: DistanceUnit,
  centerLat: number,
  centerLon: number,
  getFlagHTML: (origin: string) => string,
  altitudeColor: AltitudeColorService
): string {
  const { lat, lon, altitude, callsign, model, operator, origin } = plane;
  let speedText = '';
  if (plane.velocity) {
    const { value, label } = convertSpeedForTooltip(plane.velocity, userUnit);
    speedText = `${value}${label}`;
  }
  let altText = '';
  if (altitude) {
    const { value, label } = convertAltitudeForTooltip(altitude, userUnit);
    altText = `${value}${label}`;
  }
  const { value: distanceValue, label: distanceLabel } = convertKmToTooltipDistance(
    haversineDistanceKm(centerLat, centerLon, lat, lon),
    userUnit
  );
  return planeTooltip(
    plane.icao, callsign, origin, model, operator, speedText, altText, getFlagHTML,
    plane.isNew, plane.onGround ?? false, plane.isMilitary ?? false, plane.isSpecial ?? false,
    plane.verticalRate ?? null, altitude, (alt) => altitudeColor.getFillColor(alt), undefined,
    `${distanceValue}${distanceLabel}`
  );
}
