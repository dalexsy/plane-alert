import type { PlanesApiBuildInfo } from './planes-api-build-info';
import { NOTIFICATION_HEALTH_STALE_MS } from '../constants';

export interface NotificationHealthSlice {
  processPlanesLastSuccessAt?: number;
  collectAircraftLastSuccessAt?: number;
  lastNotificationSentAt?: number;
  processPlanesDeviceCount?: number;
  notificationsSentTotal?: number;
}

function asMillis(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return undefined;
}

function asCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === 'object' &&
    'operand' in (value as object) &&
    typeof (value as { operand: unknown }).operand === 'number'
  ) {
    return (value as { operand: number }).operand;
  }
  return undefined;
}

export function buildPlanesApiHealthResponse(input: {
  storePath: string;
  build: PlanesApiBuildInfo;
  deviceCount: number;
  health: NotificationHealthSlice;
  now?: number;
}): Record<string, unknown> {
  const now = input.now ?? Date.now();
  const processAt = asMillis(input.health.processPlanesLastSuccessAt);
  const collectAt = asMillis(input.health.collectAircraftLastSuccessAt);
  const sentAt = asMillis(input.health.lastNotificationSentAt);
  const processStale =
    !processAt || now - processAt > NOTIFICATION_HEALTH_STALE_MS;

  return {
    ok: !processStale && input.deviceCount >= 1,
    service: 'planes-api',
    storePath: input.storePath,
    version: input.build.version,
    gitSha: input.build.gitSha,
    gitShaShort: input.build.gitShaShort,
    builtAt: input.build.builtAt,
    deviceCount: input.deviceCount,
    processPlanesLastSuccessAt: processAt ?? null,
    collectAircraftLastSuccessAt: collectAt ?? null,
    lastNotificationSentAt: sentAt ?? null,
    processPlanesStale: processStale,
    notificationsSentTotal: asCount(input.health.notificationsSentTotal) ?? 0,
  };
}
