import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import { matchPushoverDeviceName } from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { inferDeviceName } from '../utils';
import { fetchDeviceDocsForUserKey } from './device-list-formatting';

function isDesktopPlatform(platform?: string): boolean {
  const p = (platform ?? '').trim().toLowerCase();
  if (!p || p === 'auto-synced') {
    return false;
  }
  if (/android/i.test(p) && /mobile/i.test(p)) {
    return false;
  }
  if (/iphone|ipad|ipod/i.test(p)) {
    return false;
  }
  return (
    /windows|macintosh|mac os x|linux|cros/i.test(p) ||
    (/chrome|firefox|safari|edg\//i.test(p) && !/android/i.test(p))
  );
}

function isMobilePushoverDeviceName(name: string): boolean {
  const lower = name.toLowerCase();
  return /pixel|galaxy|samsung|iphone|ipad|android|phone/.test(lower);
}

/**
 * Remove registration rows where a desktop browser session was matched to a mobile
 * Pushover device (e.g. Windows Edge → galaxys24). Those steal account-wide
 * cooldowns and send alerts to phones the user is not using.
 */
export async function pruneDesktopMobileMisregistrations(
  db: JsonDocumentStore,
  pushoverUserKey: string,
  pushoverDevices: string[],
): Promise<number> {
  const docs = await fetchDeviceDocsForUserKey(db, pushoverUserKey);
  let removed = 0;

  for (const [docId, doc] of docs) {
    if (!doc.exists) {
      continue;
    }
    const data = doc.data() as unknown as DeviceRegistration;
    const deviceName = inferDeviceName(docId, data);

    if (!isDesktopPlatform(data.platform)) {
      continue;
    }
    if (!isMobilePushoverDeviceName(deviceName)) {
      continue;
    }
    if (!matchPushoverDeviceName(deviceName, pushoverDevices)) {
      continue;
    }

    await doc.ref.delete();
    removed += 1;
    logger.info('Pruned desktop session matched to mobile Pushover device', {
      docId,
      deviceName,
      platform: data.platform?.slice(0, 80),
      userKey: pushoverUserKey.slice(0, 8),
    });
  }

  return removed;
}
