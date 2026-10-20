import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import webpush from 'web-push';

const VAPID_FILE = join(
  process.env.PLANES_API_DATA_DIR?.trim() || join(process.cwd(), 'data'),
  'planes-vapid.json',
);

export type PlanesVapidKeys = { publicKey: string; privateKey: string };

function keysFromEnv(): PlanesVapidKeys | null {
  const publicKey = process.env.PLANES_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.PLANES_VAPID_PRIVATE_KEY?.trim() ?? '';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

function keysFromFile(): PlanesVapidKeys | null {
  if (!existsSync(VAPID_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(VAPID_FILE, 'utf8')) as Partial<PlanesVapidKeys>;
    if (raw.publicKey && raw.privateKey) {
      return { publicKey: raw.publicKey, privateKey: raw.privateKey };
    }
  } catch {
    return null;
  }
  return null;
}

function persistKeys(keys: PlanesVapidKeys): void {
  mkdirSync(dirname(VAPID_FILE), { recursive: true });
  writeFileSync(VAPID_FILE, `${JSON.stringify(keys)}\n`, 'utf8');
}

export function loadPlanesVapidKeys(): PlanesVapidKeys | null {
  const fromEnv = keysFromEnv();
  if (fromEnv) return fromEnv;
  const fromFile = keysFromFile();
  if (fromFile) return fromFile;
  if (process.env.PLANES_API_WEB_PUSH_AUTO_VAPID !== '1') return null;
  try {
    const generated = webpush.generateVAPIDKeys();
    persistKeys(generated);
    return generated;
  } catch {
    return null;
  }
}

export function planesVapidSubject(): string {
  return process.env.PLANES_VAPID_SUBJECT?.trim() || 'mailto:admin@dryl.io';
}

export function getPlanesVapidPublicKey(): string | null {
  return loadPlanesVapidKeys()?.publicKey ?? null;
}

export function applyPlanesVapidDetails(): PlanesVapidKeys | null {
  const keys = loadPlanesVapidKeys();
  if (!keys) return null;
  webpush.setVapidDetails(planesVapidSubject(), keys.publicKey, keys.privateKey);
  return keys;
}
