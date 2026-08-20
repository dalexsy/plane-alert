/**
 * After the 2026-08 Pi split, planes-api runs on dryl-prod (.79).
 * The speaker is on magicmirror (.74). Prod POSTs; local pw-play is not audible.
 */
import { hostname as osHostname } from 'os';
import { logger } from '../pi-logger';
import type { KioskAlertVariant } from './kiosk-alert-variant';

export const DEFAULT_KIOSK_PLAY_URL = 'http://192.168.178.74:8796/play';
export const KIOSK_PLAY_TOKEN_ENV = 'PLANES_KIOSK_PLAY_TOKEN';
export const KIOSK_PLAY_URL_ENV = 'PLANES_KIOSK_PLAY_URL';

const REMOTE_TIMEOUT_MS = 45_000;

export type KioskRemotePlayBody = {
  icao: string;
  reason: string;
  variant: KioskAlertVariant;
  model?: string | null;
};

export function isKioskAlertDisabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PLANES_KIOSK_LOCAL_ALERT === '0';
}

export function isStagingKioskHost(
  env: NodeJS.ProcessEnv = process.env,
  hostName = osHostname(),
): boolean {
  if (String(env.DRYL_ENV ?? '').trim().toLowerCase() === 'staging') {
    return true;
  }
  return /staging/i.test(hostName);
}

export function isKioskAudioHost(
  hostName = osHostname(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = String(env.PLANES_KIOSK_HOST ?? 'magicmirror')
    .trim()
    .toLowerCase();
  const host = hostName.trim().toLowerCase();
  if (!expected || !host) return false;
  return host === expected || host.startsWith(`${expected}.`);
}

/** Remote when PLAY_URL is set or this process is not the kiosk speaker host. */
export function shouldUseRemoteKioskPlay(
  env: NodeJS.ProcessEnv = process.env,
  hostName = osHostname(),
): boolean {
  if (isStagingKioskHost(env, hostName)) return false;
  if (String(env[KIOSK_PLAY_URL_ENV] ?? '').trim()) return true;
  return !isKioskAudioHost(hostName, env);
}

export function resolveKioskPlayUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return String(env[KIOSK_PLAY_URL_ENV] ?? '').trim() || DEFAULT_KIOSK_PLAY_URL;
}

export function resolveKioskPlayToken(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return String(env[KIOSK_PLAY_TOKEN_ENV] ?? '').trim();
}

export type PostKioskAlertPlay = (
  body: KioskRemotePlayBody,
  env?: NodeJS.ProcessEnv,
) => Promise<boolean>;

export async function postKioskAlertPlay(
  body: KioskRemotePlayBody,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const url = resolveKioskPlayUrl(env);
  const token = resolveKioskPlayToken(env);
  if (!token) {
    logger.warn('Kiosk alert remote token missing', {
      icao: body.icao,
      reason: body.reason,
      url,
    });
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Planes-Kiosk-Play-Token': token,
      },
      body: JSON.stringify({
        icao: body.icao,
        reason: body.reason,
        variant: body.variant,
        model: body.model ?? '',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('Kiosk alert remote play failed', {
        icao: body.icao,
        reason: body.reason,
        url,
        status: response.status,
        body: text.slice(0, 300),
      });
      return false;
    }
    logger.info('Kiosk alert remote play finished', {
      icao: body.icao,
      reason: body.reason,
      variant: body.variant,
      url,
    });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk alert remote play error', {
      icao: body.icao,
      reason: body.reason,
      url,
      error: message,
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
