import {
  DEFAULT_PUSH_DEVICE_NAMES,
  PUSHOVER_USER_KEY,
} from '@plane-alert/shared';
import {
  sendPushoverNotification,
  type PushoverMessage,
} from './pushover-client';

export const ROW_SESSION_PUSH_DOC_ID = 'row-session';

export interface RowSessionPushInput {
  title: string;
  message: string;
  deviceName?: string;
}

type SendPushover = (
  userKey: string,
  deviceName: string,
  message: PushoverMessage,
  docId: string,
) => Promise<boolean>;

const CHRIS_HINT = /chris/;

function haystack(
  row: { deviceName?: string; deviceSlug?: string; platform?: string },
): string {
  return `${row.deviceName ?? ''} ${row.deviceSlug ?? ''} ${row.platform ?? ''}`.toLowerCase();
}

/**
 * Prefer Chris's Pushover device when a registration is explicitly his.
 * galaxys24 / pixel10 have no owner field — omit device so the household
 * account receives it (same path as plane alerts on his work phone).
 */
export function resolveRowSessionPushDevice(
  registrations: Array<{
    deviceName?: string;
    deviceSlug?: string;
    platform?: string;
  }>,
): string {
  const allowed = new Set(
    DEFAULT_PUSH_DEVICE_NAMES.map((name) => name.toLowerCase()),
  );
  const matches: string[] = [];
  for (const row of registrations) {
    if (!CHRIS_HINT.test(haystack(row))) {
      continue;
    }
    const name = (row.deviceName ?? '').trim();
    if (!name || !allowed.has(name.toLowerCase())) {
      continue;
    }
    matches.push(name);
  }
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : '';
}

/**
 * Temporary household Pushover for a saved row.dryl.io session.
 * Swap later for a dryl notify app. Never set model — that fetches a plane photo.
 */
export async function sendRowSessionPush(
  input: RowSessionPushInput,
  send: SendPushover = sendPushoverNotification,
): Promise<boolean> {
  const title = input.title.trim().slice(0, 250);
  const message = input.message.trim().slice(0, 1024);
  if (!title || !message) {
    return false;
  }
  const deviceName = (input.deviceName ?? '').trim();
  const payload: PushoverMessage = { title, message };
  return send(PUSHOVER_USER_KEY, deviceName, payload, ROW_SESSION_PUSH_DOC_ID);
}
