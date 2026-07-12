import {
  autoMatchPushoverDevice,
  matchPushoverDeviceName,
  PUSHOVER_UNRELIABLE_DEVICE_NAMES,
} from '@plane-alert/shared';

export function resolveRegistrationDeviceName(
  requestedName: string | undefined,
  platform: string | undefined,
  clientModel: string | undefined,
  pushoverDevices: string[],
): string | null {
  const trimmed = requestedName?.trim();
  if (trimmed) {
    const exact = matchPushoverDeviceName(trimmed, pushoverDevices);
    if (
      exact &&
      !PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(exact.toLowerCase())
    ) {
      return exact;
    }
  }

  return autoMatchPushoverDevice({
    userAgent: platform ?? '',
    model: clientModel,
    pushoverDevices,
  });
}
