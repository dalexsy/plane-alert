/**
 * Play a local MP3 on magicmirror when prefix-only military is notified.
 * Live SPA gates kiosk MP3 on DB mil only; phones still TTS via callsign prefix.
 * planes-api can ship this without republishing the SPA (deploy:fast).
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';

const KIOSK_QUIET_TZ = 'Europe/Berlin';
const KIOSK_QUIET_START_HOUR = 22;
const KIOSK_QUIET_END_HOUR = 7;
const MIN_PLAY_INTERVAL_MS = 8000;
const ICAO_COOLDOWN_MS = 10 * 60 * 1000;

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

function playWithPlayer(player: string, mp3Path: string): boolean {
  try {
    const child = spawn(player, [mp3Path], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        XDG_RUNTIME_DIR:
          process.env.XDG_RUNTIME_DIR || '/run/user/1000',
      },
    });
    child.unref();
    child.on('error', (err) => {
      logger.warn('Kiosk alert player failed', {
        player,
        error: err.message,
      });
    });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk alert spawn failed', { player, error: message });
    return false;
  }
}

/**
 * Fire-and-forget local alert for prefix-military that SPA cannot hear yet.
 * No-op during quiet hours, when disabled, or when the MP3 is missing.
 */
export function playKioskAlertSound(icao: string, reason: string): void {
  if (process.env.PLANES_KIOSK_LOCAL_ALERT === '0') return;
  if (isKioskQuietHoursBerlin()) {
    logger.info('Kiosk alert skipped — quiet hours', { icao, reason });
    return;
  }

  const now = Date.now();
  if (now - lastPlayAt < MIN_PLAY_INTERVAL_MS) return;

  const key = icao.toUpperCase();
  const prior = lastPlayedByIcao.get(key) ?? 0;
  if (now - prior < ICAO_COOLDOWN_MS) return;

  const mp3Path = resolveAlertMp3();
  if (!mp3Path) {
    logger.warn('Kiosk alert MP3 missing', { icao, reason });
    return;
  }

  const players = ['pw-play', 'paplay', 'aplay'];
  for (const player of players) {
    if (playWithPlayer(player, mp3Path)) {
      lastPlayAt = now;
      lastPlayedByIcao.set(key, now);
      logger.info('Kiosk alert sound started', { icao, reason, player, mp3Path });
      return;
    }
  }
  logger.warn('Kiosk alert: no audio player worked', { icao, reason });
}
