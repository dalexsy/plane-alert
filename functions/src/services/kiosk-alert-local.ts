/**
 * Local pw-play fallback — not the live path. planes-api runs on dryl-prod
 * (.79), which has no pw-play/paplay and no PipeWire sinks. Live chimes POST
 * the .74 listener. Do not re-enable leftover planes-api on magicmirror.
 */
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../pi-logger';
import {
  kioskAlertFileName,
  type KioskAlertVariant,
} from './kiosk-alert-variant';

export function resolveAlertMp3(variant: KioskAlertVariant): string | null {
  const fileName = kioskAlertFileName(variant);
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

export function resolvePlayer(): string | null {
  for (const absolute of ['/usr/bin/pw-play', '/usr/bin/paplay']) {
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

export function playWithPlayer(
  player: string,
  mp3Path: string,
  icao: string,
  reason: string,
  onPlayed?: () => void,
  onSettled?: () => void,
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
      onSettled?.();
      logger.warn('Kiosk alert player failed', {
        player,
        icao,
        reason,
        error: err.message,
      });
    });
    child.on('exit', (code) => {
      onSettled?.();
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
