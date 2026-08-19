import { PUSHOVER_USER_KEY } from '@plane-alert/shared';
import { onRequest } from '../on-request';
import { logger } from '../pi-logger';
import { DEVICE_COLLECTION } from '../constants';
import { handleOptionsPreflight } from '../http';
import type { DeviceRegistration } from '../types';
import { JsonDocumentStore } from '../json-document-store';
import { isRowSessionNotifyAuthorized, rowSessionNotifySecret } from './row-session-push-auth';
import {
  resolveRowSessionPushDevice,
  sendRowSessionPush,
} from './row-session-push';

const ROW_NOTIFY_ORIGIN = 'https://row.dryl.io';

function applyRowSessionNotifyCors(res: {
  set: (name: string, value: string) => void;
}): void {
  res.set('Access-Control-Allow-Origin', ROW_NOTIFY_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Row-Notify-Secret',
  );
}

function readTextField(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function householdRegistrations(
  db: JsonDocumentStore,
): Promise<DeviceRegistration[]> {
  const snapshot = await db.collection(DEVICE_COLLECTION).get();
  const rows: DeviceRegistration[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() as unknown as DeviceRegistration;
    if (data?.pushoverUserKey === PUSHOVER_USER_KEY) {
      rows.push(data);
    }
  }
  return rows;
}

export function createNotifyRowSessionHandler(db: JsonDocumentStore) {
  return onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyRowSessionNotifyCors(res);
    if (handleOptionsPreflight(req, res)) {
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!rowSessionNotifySecret()) {
      logger.warn('Row session notify refused — secret not configured');
      res.status(503).json({ error: 'not configured' });
      return;
    }
    if (!isRowSessionNotifyAuthorized(req)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const title = readTextField(req.body, 'title');
    const message = readTextField(req.body, 'message');
    if (!title || !message) {
      res.status(400).json({ error: 'title and message are required' });
      return;
    }

    try {
      const deviceName = resolveRowSessionPushDevice(
        await householdRegistrations(db),
      );
      const sent = await sendRowSessionPush({ title, message, deviceName });
      logger.info('Row session Pushover attempted', {
        sent,
        targetedDevice: deviceName || 'household',
      });
      res.status(200).json({ ok: true, sent, targetedDevice: deviceName || 'household' });
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.error('notifyRowSession failed', { error: errMessage });
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
