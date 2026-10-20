import type { DeviceRegistration } from '../types';

function pwaInstallationFromDocId(docId: string): string | null {
  const trimmed = docId.trim();
  if (!trimmed.startsWith('pwa_')) return null;
  const id = trimmed.slice(4).trim();
  return id || null;
}

export function installationIdForRegistration(
  data: DeviceRegistration,
  docId: string,
): string | null {
  return data.installationId?.trim() || pwaInstallationFromDocId(docId);
}

/** PWA installation row (own cron lane). Not inferred from location alone. */
export function isPwaInstallationRegistration(
  docId: string,
  data: DeviceRegistration,
): boolean {
  if (docId.trim().startsWith('pwa_')) return true;
  return (
    data.pwaNotificationsEnabled === true &&
    Boolean(data.installationId?.trim())
  );
}

export function hasValidWebPushSubscription(data: DeviceRegistration): boolean {
  const endpoint = data.webPushSubscription?.endpoint?.trim();
  const p256dh = data.webPushSubscription?.keys?.p256dh?.trim();
  const auth = data.webPushSubscription?.keys?.auth?.trim();
  return Boolean(endpoint && p256dh && auth);
}

export function hasConfirmedWebPushPrimary(
  data: DeviceRegistration,
): boolean {
  return (
    data.deliveryChannelPreference === 'pwa' &&
    typeof data.webPushChannelConfirmedAt === 'number' &&
    data.webPushChannelConfirmedAt > 0
  );
}

/** New install: no existing Pushover row linked on this registration. */
export function isPwaOnlyInstallation(data: DeviceRegistration): boolean {
  return !data.pushoverUserKey?.trim() && data.pushoverFallbackEnabled !== true;
}

/**
 * Linked Pushover user migrating to PWA — automatic aircraft alerts stay on
 * Pushover until the user confirms a received test and chooses Web Push.
 */
export function isUnconfirmedMigratingPwa(
  docId: string,
  data: DeviceRegistration,
): boolean {
  if (!isPwaInstallationRegistration(docId, data)) {
    return false;
  }
  if (isPwaOnlyInstallation(data)) {
    return false;
  }
  if (data.deliveryChannelPreference === 'pushover') {
    return false;
  }
  return !hasConfirmedWebPushPrimary(data);
}

/** Try Web Push first when this registration is allowed to use it for alerts. */
export function prefersPwaDelivery(
  data: DeviceRegistration,
  docId: string,
): boolean {
  if (!data.pwaNotificationsEnabled || !hasValidWebPushSubscription(data)) {
    return false;
  }
  if (isUnconfirmedMigratingPwa(docId, data)) {
    return false;
  }
  return isPwaOnlyInstallation(data) || hasConfirmedWebPushPrimary(data);
}

/** Cooldown + history id: per-PWA installation or Pushover household account. */
export function notificationAccountKey(
  data: DeviceRegistration,
  docId: string,
): string | null {
  if (
    isPwaInstallationRegistration(docId, data) &&
    !isUnconfirmedMigratingPwa(docId, data)
  ) {
    const id = installationIdForRegistration(data, docId);
    if (id) return `pwa:${id}`;
  }
  const pushover = data.pushoverUserKey?.trim();
  if (pushover) return pushover;
  return null;
}

export function canDeliverPushover(
  data: DeviceRegistration,
  registeredPushoverDevices?: Set<string> | null,
): boolean {
  const userKey = data.pushoverUserKey?.trim();
  if (!userKey) return false;
  if (!data.deviceName?.trim()) return false;
  if (registeredPushoverDevices === null) return false;
  if (registeredPushoverDevices && registeredPushoverDevices.size > 0) {
    const name = data.deviceName.trim();
    if (!registeredPushoverDevices.has(name)) {
      for (const candidate of registeredPushoverDevices) {
        if (candidate.toLowerCase() === name.toLowerCase()) return true;
      }
      return false;
    }
  }
  return true;
}

export type DeliveryChannel = 'pwa' | 'pushover';

export function resolveDeliveryChannels(
  data: DeviceRegistration,
  registeredPushoverDevices?: Set<string> | null,
  docId = '',
): DeliveryChannel[] {
  const channels: DeliveryChannel[] = [];
  const pwaInstall = isPwaInstallationRegistration(docId, data);

  if (pwaInstall && isUnconfirmedMigratingPwa(docId, data)) {
    return [];
  }

  if (pwaInstall && data.deliveryChannelPreference === 'pushover') {
    if (canDeliverPushover(data, registeredPushoverDevices)) {
      return ['pushover'];
    }
    return [];
  }

  const pwaOptIn = data.pwaNotificationsEnabled === true;
  const hasSub = hasValidWebPushSubscription(data);
  const pushoverOk = canDeliverPushover(data, registeredPushoverDevices);
  const fallback = data.pushoverFallbackEnabled === true;
  const mayUsePwa =
    pwaOptIn &&
    hasSub &&
    (isPwaOnlyInstallation(data) || hasConfirmedWebPushPrimary(data));

  if (mayUsePwa) {
    channels.push('pwa');
  }

  if (pushoverOk) {
    const legacyPushoverOnly =
      !pwaInstall && !pwaOptIn && Boolean(data.pushoverUserKey?.trim());
    const pushoverAfterFailedPwa =
      pwaInstall && mayUsePwa && fallback;
    const pushoverWithoutSub =
      pwaInstall && pwaOptIn && !hasSub && fallback;
    if (legacyPushoverOnly || pushoverAfterFailedPwa || pushoverWithoutSub) {
      if (!channels.includes('pushover')) {
        channels.push('pushover');
      }
    }
  }

  if (!pwaInstall && pushoverOk && !channels.length) {
    channels.push('pushover');
  }

  return channels;
}

export function deviceHasNotificationDestination(
  data: DeviceRegistration,
  registeredPushoverDevices?: Set<string> | null,
  docId = '',
): boolean {
  return (
    resolveDeliveryChannels(data, registeredPushoverDevices, docId).length > 0
  );
}
