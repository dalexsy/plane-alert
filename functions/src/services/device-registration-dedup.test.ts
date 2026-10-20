import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  indexPwaInstallationsById,
  isPushoverRegistrationSuppressedByPwa,
} from './device-registration-dedup';

const sub = {
  endpoint: 'https://push.example/ep',
  keys: { p256dh: 'k', auth: 'a' },
};

describe('device-registration-dedup', () => {
  it('does not suppress unrelated Pushover devices on the same account', () => {
    const installId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pwa = {
      id: `pwa_${installId}`,
      data: {
        installationId: installId,
        pwaNotificationsEnabled: true,
        webPushSubscription: sub,
        deliveryChannelPreference: 'pwa' as const,
        webPushChannelConfirmedAt: 1000,
      },
    };
    const chrisWorkPhone = {
      id: 'user__workphone',
      data: {
        pushoverUserKey: 'user',
        deviceName: 'workphone',
      },
    };
    const index = indexPwaInstallationsById([pwa]);
    assert.equal(
      isPushoverRegistrationSuppressedByPwa(chrisWorkPhone, index),
      false,
    );
  });
});
