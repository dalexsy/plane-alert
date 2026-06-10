import type { NotificationCooldownRecord } from './military-history.types';

export function buildLocationKey(
  location?: { lat: number; lon: number; address?: string },
  fallback?: string,
): string {
  if (location) {
    return `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
  }

  return fallback || 'unknown';
}

export function parseCooldownDocId(
  userKey: string,
  docId: string,
): NotificationCooldownRecord | null {
  if (!docId.startsWith(`${userKey}__`)) {
    return null;
  }

  const suffix = docId.slice(userKey.length + 2);
  const parts = suffix.split('__').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const lastPart = parts[parts.length - 1];
  if (!lastPart || lastPart.toLowerCase().startsWith('proximity_')) {
    return null;
  }

  return {
    docId,
    icao: lastPart.toLowerCase(),
    deviceName: parts.length > 1 ? parts.slice(0, -1).join('__') : undefined,
    lastSent: 0,
  };
}