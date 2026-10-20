import type { DeviceRegistration } from '../types';
import {
  hasConfirmedWebPushPrimary,
  installationIdForRegistration,
  isPwaInstallationRegistration,
} from './notification-delivery';

export type RegistrationEntry = {
  id: string;
  data: DeviceRegistration;
};

export function indexPwaInstallationsById(
  devices: RegistrationEntry[],
): Map<string, RegistrationEntry> {
  const map = new Map<string, RegistrationEntry>();
  for (const entry of devices) {
    if (!isPwaInstallationRegistration(entry.id, entry.data)) {
      continue;
    }
    const installId = installationIdForRegistration(entry.data, entry.id);
    if (!installId) {
      continue;
    }
    map.set(installId, entry);
  }
  return map;
}

/**
 * Suppress duplicate Pushover sends only after the user confirmed Web Push on
 * the linked installation. A valid subscription alone is not enough.
 */
export function isPushoverRegistrationSuppressedByPwa(
  entry: RegistrationEntry,
  pwaByInstallation: Map<string, RegistrationEntry>,
): boolean {
  if (isPwaInstallationRegistration(entry.id, entry.data)) {
    return false;
  }
  if (!entry.data.pushoverUserKey?.trim()) {
    return false;
  }
  const installId = entry.data.installationId?.trim();
  if (!installId) {
    return false;
  }
  if (entry.data.deliveryChannelPreference === 'pushover') {
    return false;
  }
  const pwa = pwaByInstallation.get(installId);
  if (!pwa) {
    return false;
  }
  return hasConfirmedWebPushPrimary(pwa.data);
}
