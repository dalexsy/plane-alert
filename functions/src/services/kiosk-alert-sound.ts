/**
 * Play a local MP3 on magicmirror when military/special newly enters range.
 * Live SPA kiosk audio is unreliable (stale bundle); phones still TTS.
 * planes-api ships this without republishing the SPA (deploy:fast).
 *
 * Visit edge lives in kiosk-in-range-edge-state — do not re-chime loiterers
 * on a rolling timer. Rate-limit only backs up multi-ICAO bursts.
 */
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';
import {
  kioskAlertFileName,
  kioskAlertVariantFromModel,
  type KioskAlertVariant,
} from './kiosk-alert-variant';

const KIOSK_QUIET_TZ = 'Europe/Berlin';
const KIOSK_QUIET_START_HOUR = 22;
const KIOSK_QUIET_END_HOUR = 7;
const MIN_PLAY_INTERVAL_MS = 8000;

let lastPlayAt = 0;
/** ICAOs with an in-flight pw-play — avoid double-spawn before exit. */
const inFlightIcaos = new Set<string>();

export type KioskAlertPlayOptions = {
  /** Called after successful audible play, or when quiet hours absorb the visit. */
  onPlayed?: () => void;
  /** Aircraft model — picks hercules / A400 (iago) / default mil MP3. */
  model?: string | null;
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

function resolveAlertMp3(variant: KioskAlertVariant): string | null {
  const fileName = kioskAlertFileName(variant);
  // Env override is default mil only — never force it over A400/Hercules.
  if (variant === 'default') {
    const fromEnv = process.env.PLANES_KIOSK_ALERT_MP3?.trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  }
  const candidates = [
    path.join(process.cwd(), 'assets', 'alerts', fileName),
    path.join(__dirname, '..', 'assets', 'alerts', fileName),
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (hit) return hit;
  if (variant !== 'default') {
    logger.warn('Kiosk alert variant MP3 missing — falling back to default', {
      variant,
      fileName,
    });
    return resolveAlertMp3('default');
  }
  return null;
}

function resolvePlayer(): string | null {
  for (const absolute of ['/usr/bin/pw-play', '/usr/bin/paplay']) {
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

function playWithPlayer(
  player: string,
  mp3Path: string,
  icao: string,
  reason: string,
  onPlayed?: () => void,
): ChildProcess | null {
  try {
    const child = spawn(player, [mp3Path], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1000',
      },
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      inFlightIcaos.delete(icao.toUpperCase());
      logger.warn('Kiosk alert player failed', {
        player,
        icao,
        reason,
        error: err.message,
      });
    });
    child.on('exit', (code) => {
      const key = icao.toUpperCase();
      inFlightIcaos.delete(key);
      if (code === 0 || code === null) {
        onPlayed?.();
        logger.info('Kiosk alert sound finished', { icao, reason, code });
        return;
      }
      logger.warn('Kiosk alert player exit', {
        player,
        icao,
        reason,
        code,
        stderr: stderr.slice(0, 300),
      });
    });
    return child;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk alert spawn failed', { player, icao, reason, error: message });
    return null;
  }
}

/**
 * Fire-and-forget local alert for military/special that SPA may not hear.
 * No-op during quiet hours, when disabled, or when the MP3 is missing.
 * Quiet hours still invoke onPlayed so the visit is absorbed (no 7am dump).
 */
export function playKioskAlertSound(
  icao: string,
  reason: string,
  options?: KioskAlertPlayOptions,
): void {
  if (process.env.PLANES_KIOSK_LOCAL_ALERT === '0') return;
  if (isKioskQuietHoursBerlin()) {
    logger.info('Kiosk alert skipped — quiet hours', { icao, reason });
    options?.onPlayed?.();
    return;
  }

  const now = Date.now();
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
  const mp3Path = resolveAlertMp3(variant);
  if (!mp3Path) {
    logger.warn('Kiosk alert MP3 missing', { icao, reason, variant });
    return;
  }

  const player = resolvePlayer();
  if (!player) {
    logger.warn('Kiosk alert: no audio player found', { icao, reason });
    return;
  }

  inFlightIcaos.add(key);
  if (!playWithPlayer(player, mp3Path, icao, reason, options?.onPlayed)) {
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
