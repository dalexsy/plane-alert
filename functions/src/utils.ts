import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import {
  SPECIAL_ICAOS,
  DEFAULT_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  RECENT_NOTIFICATION_TTL_MS,
} from './constants';
import type { DeviceRegistration } from './types';

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

export function isSpecialAircraft(icao: string): boolean {
  return SPECIAL_ICAOS.includes(icao.toLowerCase());
}

export function sanitizeDeviceName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'default';
  }
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'default';
}

export function getDeviceDocId(
  pushoverUserKey: string,
  deviceName: string
): string {
  const slug = sanitizeDeviceName(deviceName);
  return `${pushoverUserKey}__${slug}`;
}

export function inferDeviceName(
  docId: string,
  data: DeviceRegistration
): string {
  if (data.deviceName && data.deviceName.trim().length > 0) {
    return data.deviceName.trim();
  }
  if (data.deviceSlug && data.deviceSlug.trim().length > 0) {
    return data.deviceSlug.trim();
  }
  const splitIndex = docId.indexOf('__');
  if (splitIndex !== -1 && splitIndex + 2 < docId.length) {
    const slug = docId.slice(splitIndex + 2);
    if (slug) {
      // Return the slug as-is (don't convert hyphens to spaces)
      // Pushover device names must match exactly
      return slug;
    }
  }
  return 'default';
}

export async function validatePushoverUserKey(
  pushoverUserKey: string
): Promise<{ devices: string[]; valid: boolean }> {
  if (!PUSHOVER_API_TOKEN) {
    return { devices: [], valid: false };
  }

  try {
    const params = new URLSearchParams({
      token: PUSHOVER_API_TOKEN,
      user: pushoverUserKey,
    });

    const response = await fetch(
      'https://api.pushover.net/1/users/validate.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        timeout: 4000,
      } as any
    );

    if (!response.ok) {
      logger.warn('Pushover validate call failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return { devices: [], valid: false };
    }

    const result: any = await response.json();
    if (result.status !== 1) {
      return { devices: [], valid: false };
    }

    const devices: string[] = Array.isArray(result.devices)
      ? result.devices.map((device: any) => String(device)).filter(Boolean)
      : [];

    return { devices, valid: true };
  } catch (error: any) {
    logger.warn('Failed to validate Pushover key', {
      error: error?.message,
    });
    return { devices: [], valid: false };
  }
}

export function clampRadius(radiusKm?: number | null): number {
  if (typeof radiusKm !== 'number' || Number.isNaN(radiusKm)) {
    return DEFAULT_RADIUS_KM;
  }
  return Math.min(Math.max(radiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM);
}

export function pruneOldNotifications(
  map: Record<string, number>
): Record<string, number> {
  const cutoff = Date.now() - RECENT_NOTIFICATION_TTL_MS;
  const next: Record<string, number> = {};
  for (const [icao, timestamp] of Object.entries(map)) {
    if (timestamp >= cutoff) {
      next[icao] = timestamp;
    }
  }
  return next;
}
