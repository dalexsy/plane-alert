/**
 * Military/special kiosk chime. planes-api is dryl-prod (.79) only — that
 * host has no pw-play and no PipeWire sinks. Prod POSTs the .74 listener,
 * which pw-plays to the wpctl Jabra SPEAK 510 (leftover API unit stays down).
 *
 * Visit edge lives in kiosk-in-range-edge-state. Rate-limit backs up bursts.
 */
import { hostname as osHostname } from 'os';
import { logger } from '../pi-logger';
import { kioskAlertVariantFromModel } from './kiosk-alert-variant';
import {
  playWithPlayer,
  resolveAlertMp3,
  resolvePlayer,
} from './kiosk-alert-local';
import {
  isKioskAlertDisabled,
  isStagingKioskHost,
  postKioskAlertPlay,
  shouldUseRemoteKioskPlay,
  type PostKioskAlertPlay,
} from './kiosk-alert-remote';

const KIOSK_QUIET_TZ = 'Europe/Berlin';
const KIOSK_QUIET_START_HOUR = 22;
const KIOSK_QUIET_END_HOUR = 7;
const MIN_PLAY_INTERVAL_MS = 8000;

let lastPlayAt = 0;
const inFlightIcaos = new Set<string>();

export type KioskAlertPlayOptions = {
  /** Called after successful audible play, or when quiet hours absorb the visit. */
  onPlayed?: () => void;
  /** Aircraft model — picks hercules / A400 (iago) / default mil MP3. */
  model?: string | null;
};

export type KioskAlertPlayHooks = {
  env?: NodeJS.ProcessEnv;
  hostname?: string;
  now?: Date;
  nowMs?: number;
  postRemote?: PostKioskAlertPlay;
  spawnLocal?: typeof playWithPlayer;
  resolvePlayerBin?: () => string | null;
};

/** Same overnight window as SPA `isKioskQuietHours` (22:00–07:00 Berlin). */
export function isKioskQuietHoursBerlin(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: KIOSK_QUIET_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
      hour12: false,
    }).format(now),
  );
  if (!Number.isFinite(hour)) return false;
  return hour >= KIOSK_QUIET_START_HOUR || hour < KIOSK_QUIET_END_HOUR;
}

export function resetKioskAlertSoundForTests(): void {
  lastPlayAt = 0;
  inFlightIcaos.clear();
}

/**
 * Fire-and-forget alert for military/special that SPA may not hear.
 * Quiet hours still invoke onPlayed so the visit is absorbed (no 7am dump).
 */
export function playKioskAlertSound(
  icao: string,
  reason: string,
  options?: KioskAlertPlayOptions,
  hooks?: KioskAlertPlayHooks,
): void {
  void playKioskAlertSoundAsync(icao, reason, options, hooks);
}

export async function playKioskAlertSoundAsync(
  icao: string,
  reason: string,
  options?: KioskAlertPlayOptions,
  hooks?: KioskAlertPlayHooks,
): Promise<void> {
  const env = hooks?.env ?? process.env;
  const hostName = hooks?.hostname ?? osHostname();
  if (isKioskAlertDisabled(env) || isStagingKioskHost(env, hostName)) return;
  const nowDate = hooks?.now ?? new Date();
  if (isKioskQuietHoursBerlin(nowDate)) {
    logger.info('Kiosk alert skipped — quiet hours', { icao, reason });
    options?.onPlayed?.();
    return;
  }

  const now = hooks?.nowMs ?? Date.now();
  if (now - lastPlayAt < MIN_PLAY_INTERVAL_MS) {
    logger.info('Kiosk alert skipped — min interval', { icao, reason });
    return;
  }

  const key = icao.toUpperCase();
  if (inFlightIcaos.has(key)) {
    logger.info('Kiosk alert skipped — already playing', { icao, reason });
    return;
  }

  const variant = kioskAlertVariantFromModel(options?.model);
  if (shouldUseRemoteKioskPlay(env, hostName)) {
    const postRemote = hooks?.postRemote ?? postKioskAlertPlay;
    inFlightIcaos.add(key);
    lastPlayAt = now;
    const ok = await postRemote(
      { icao, reason, variant, model: options?.model },
      env,
    );
    inFlightIcaos.delete(key);
    if (ok) {
      options?.onPlayed?.();
      return;
    }
    logger.warn('Kiosk alert: remote trigger failed', { icao, reason, variant });
    return;
  }

  const mp3Path = resolveAlertMp3(variant);
  if (!mp3Path) {
    logger.warn('Kiosk alert MP3 missing', { icao, reason, variant });
    return;
  }

  const player = (hooks?.resolvePlayerBin ?? resolvePlayer)();
  if (!player) {
    logger.warn('Kiosk alert: no audio player found', { icao, reason });
    return;
  }

  const spawnLocal = hooks?.spawnLocal ?? playWithPlayer;
  inFlightIcaos.add(key);
  if (
    !spawnLocal(player, mp3Path, icao, reason, options?.onPlayed, () => {
      inFlightIcaos.delete(key);
    })
  ) {
    inFlightIcaos.delete(key);
    logger.warn('Kiosk alert: spawn failed', { icao, reason, player });
    return;
  }

  lastPlayAt = now;
  logger.info('Kiosk alert sound started', {
    icao,
    reason,
    variant,
    player,
    mp3Path,
  });
}
