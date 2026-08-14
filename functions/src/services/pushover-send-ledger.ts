import { JsonDocumentStore } from '../json-document-store';
import { FieldValue } from '../document-fields';
import {
  NOTIFICATION_HEALTH_DOC_ID,
  SYSTEM_HEALTH_COLLECTION,
} from '../constants';
import { berlinCalendarDay } from './berlin-day';

export const PUSHOVER_SEND_LEDGER_MAX = 40;

export type PushoverSendRow = {
  icao: string;
  at: number;
};

export function appendSendRow(
  existing: PushoverSendRow[] | undefined,
  row: PushoverSendRow,
): PushoverSendRow[] {
  const icao = row.icao.trim().toUpperCase();
  if (!icao || !Number.isFinite(row.at)) {
    return [...(existing ?? [])].slice(-PUSHOVER_SEND_LEDGER_MAX);
  }
  return [...(existing ?? []), { icao, at: row.at }].slice(
    -PUSHOVER_SEND_LEDGER_MAX,
  );
}

/** ICAOs that already have two household sends on the same Berlin day. */
export function duplicateIcaosSameBerlinDay(
  sends: PushoverSendRow[] | undefined,
): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const row of sends ?? []) {
    const icao = row.icao?.trim().toUpperCase();
    if (!icao || !Number.isFinite(row.at)) {
      continue;
    }
    const key = `${icao}|${berlinCalendarDay(row.at)}`;
    if (seen.has(key)) {
      dups.add(icao);
    } else {
      seen.add(key);
    }
  }
  return [...dups];
}

export async function recordPushoverSend(
  db: JsonDocumentStore,
  icao: string,
): Promise<void> {
  const ref = db
    .collection(SYSTEM_HEALTH_COLLECTION)
    .doc(NOTIFICATION_HEALTH_DOC_ID);
  const snap = await ref.get();
  const data = (snap.data() ?? {}) as { recentPushoverSends?: PushoverSendRow[] };
  const now = Date.now();
  const recent = appendSendRow(data.recentPushoverSends, { icao, at: now });
  await ref.set(
    {
      lastNotificationSentAt: now,
      notificationsSentTotal: FieldValue.increment(1),
      recentPushoverSends: recent,
    },
    { merge: true },
  );
}
