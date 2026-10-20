import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceHasNotificationDestination,
  hasConfirmedWebPushPrimary,
  isUnconfirmedMigratingPwa,
  resolveDeliveryChannels,
} from './notification-delivery';
import { isPushoverRegistrationSuppressedByPwa } from './device-registration-dedup';

const sub = {
  endpoint: 'https://push.example/ep',
  keys: { p256dh: 'k', auth: 'a' },
};

const home = { lat: 52.45, lon: 13.52 };

function legacyPushover() {
  return {
    pushoverUserKey: 'user-key-abc',
    deviceName: 'pixel10',
    location: home,
    radiusKm: 100,
  };
}

describe('notification-delivery migration', () => {
  it('keeps Pushover for linked PWA with subscription but no user confirm', () => {
    const installId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwaDocId = `pwa_${installId}`;
    const migrating = {
      installationId: installId,
      pwaNotificationsEnabled: true,
      webPushSubscription: sub,
      pushoverUserKey: 'user-key-abc',
      deviceName: 'pixel10',
      pushoverFallbackEnabled: true,
      location: home,
    };
    assert.equal(isUnconfirmedMigratingPwa(pwaDocId, migrating), true);
    assert.deepEqual(
      resolveDeliveryChannels(migrating, new Set(['pixel10']), pwaDocId),
      [],
    );
    assert.deepEqual(
      resolveDeliveryChannels(legacyPushover(), new Set(['pixel10']), 'user__pixel10'),
      ['pushover'],
    );
    const index = new Map([
      [
        installId,
        { id: pwaDocId, data: migrating },
      ],
    ]);
    assert.equal(
      isPushoverRegistrationSuppressedByPwa(
        { id: 'user__pixel10', data: { ...legacyPushover(), installationId: installId } },
        index,
      ),
      false,
    );
  });

  it('switches to Web Push after explicit confirm', () => {
    const installId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwaDocId = `pwa_${installId}`;
    const confirmed = {
      installationId: installId,
      pwaNotificationsEnabled: true,
      webPushSubscription: sub,
      pushoverUserKey: 'user-key-abc',
      deviceName: 'pixel10',
      pushoverFallbackEnabled: true,
      deliveryChannelPreference: 'pwa' as const,
      webPushChannelConfirmedAt: Date.now(),
      location: home,
    };
    assert.equal(hasConfirmedWebPushPrimary(confirmed), true);
    assert.deepEqual(
      resolveDeliveryChannels(confirmed, new Set(['pixel10']), pwaDocId),
      ['pwa', 'pushover'],
    );
    const index = new Map([[installId, { id: pwaDocId, data: confirmed }]]);
    assert.equal(
      isPushoverRegistrationSuppressedByPwa(
        {
          id: 'user__pixel10',
          data: { ...legacyPushover(), installationId: installId },
        },
        index,
      ),
      true,
    );
  });

  it('allows PWA-only installs to use Web Push immediately', () => {
    const installId = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwaOnly = {
      installationId: installId,
      pwaNotificationsEnabled: true,
      webPushSubscription: sub,
      location: home,
    };
    const pwaDocId = `pwa_${installId}`;
    assert.equal(isUnconfirmedMigratingPwa(pwaDocId, pwaOnly), false);
    assert.deepEqual(
      resolveDeliveryChannels(pwaOnly, undefined, pwaDocId),
      ['pwa'],
    );
  });

  it('uses Pushover fallback when subscription expired on confirmed install', () => {
    const installId = 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwaDocId = `pwa_${installId}`;
    const expired = {
      installationId: installId,
      pwaNotificationsEnabled: true,
      pushoverUserKey: 'user-key-abc',
      deviceName: 'pixel10',
      pushoverFallbackEnabled: true,
      deliveryChannelPreference: 'pwa' as const,
      webPushChannelConfirmedAt: 1,
      location: home,
    };
    assert.deepEqual(
      resolveDeliveryChannels(expired, new Set(['pixel10']), pwaDocId),
      ['pushover'],
    );
    assert.equal(
      deviceHasNotificationDestination(expired, new Set(['pixel10']), pwaDocId),
      true,
    );
  });

  it('reverts to Pushover when user prefers Pushover on installation', () => {
    const installId = 'dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwaDocId = `pwa_${installId}`;
    const reverted = {
      installationId: installId,
      pwaNotificationsEnabled: true,
      webPushSubscription: sub,
      pushoverUserKey: 'user-key-abc',
      deviceName: 'pixel10',
      deliveryChannelPreference: 'pushover' as const,
      location: home,
    };
    assert.deepEqual(
      resolveDeliveryChannels(reverted, new Set(['pixel10']), pwaDocId),
      ['pushover'],
    );
    const index = new Map([[installId, { id: pwaDocId, data: reverted }]]);
    assert.equal(
      isPushoverRegistrationSuppressedByPwa(
        {
          id: 'user__pixel10',
          data: { ...legacyPushover(), installationId: installId },
        },
        index,
      ),
      false,
    );
  });
});
