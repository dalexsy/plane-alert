/**
 * Play a local MP3 on magicmirror when military/special Pushover is delivered.
 * Live SPA kiosk audio is unreliable (stale bundle); phones still TTS.
 * planes-api ships this without republishing the SPA (deploy:fast).
 */
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';

const KIOSK_QUIET_TZ = 'Europe/Berlin';
const KIOSK_QUIET_START_HOUR = 22;
const KIOSK_QUIET_END_HOUR = 7;
const MIN_PLAY_INTERVAL_MS = 8000;
/** Match Pushover TTL so loitering mil does not re-chime every few minutes. */
const ICAO_COOLDOWN_MS = 30 * 60 * 1000;

let lastPlayAt = 0;
const lastPlayedByIcao = new Map<string, number>();

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

function resolveAlertMp3(): string | null {
  const fromEnv = process.env.PLANES_KIOSK_ALERT_MP3?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.join(process.cwd(), 'assets', 'alerts', 'precious_little_life_forms.mp3'),
    path.join(__dirname, '..', 'assets', 'alerts', 'precious_little_life_forms.mp3'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function resolvePlayer(): string | null {
  for (const absolute of ['/usr/bin/pw-play', '/usr/bin/paplay']) {
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

function playWithPlayer(player: string, mp3Path: string): ChildProcess | null {
  try {
    const child = spawn(player, [mp3Path], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1000',
      },
    });
    child.unref();
    child.on('error', (err) => {
      logger.warn('Kiosk alert player failed', {
        player,
        error: err.message,
      });
    });
    return child;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk alert spawn failed', { player, error: message });
    return null;
  }
}

/**
 * Fire-and-forget local alert for military/special that SPA may not hear.
 * No-op during quiet hours, when disabled, or when the MP3 is missing.
 */
export function playKioskAlertSound(icao: string, reason: string): void {
  if (process.env.PLANES_KIOSK_LOCAL_ALERT === '0') return;
  if (isKioskQuietHoursBerlin()) {
    logger.info('Kiosk alert skipped — quiet hours', { icao, reason });
    return;
  }

  const now = Date.now();
  if (now - lastPlayAt < MIN_PLAY_INTERVAL_MS) {
    logger.info('Kiosk alert skipped — min interval', { icao, reason });
    return;
  }

  const key = icao.toUpperCase();
  const prior = lastPlayedByIcao.get(key) ?? 0;
  if (now - prior < ICAO_COOLDOWN_MS) {
    logger.info('Kiosk alert skipped — icao cooldown', { icao, reason });
    return;
  }

  const mp3Path = resolveAlertMp3();
  if (!mp3Path) {
    logger.warn('Kiosk alert MP3 missing', { icao, reason });
    return;
  }

  const player = resolvePlayer();
  if (!player) {
    logger.warn('Kiosk alert: no audio player found', { icao, reason });
    return;
  }

  if (!playWithPlayer(player, mp3Path)) {
    logger.warn('Kiosk alert: spawn failed', { icao, reason, player });
    return;
  }

  lastPlayAt = now;
  lastPlayedByIcao.set(key, now);
  logger.info('Kiosk alert sound started', { icao, reason, player, mp3Path });
}
