import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  pwaAlertsRegisterEndpoint,
  pwaVapidPublicKeyEndpoint,
} from '../../config/planes-api.config';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PUSH_HOME } from '@plane-alert/shared';
import { PushRegistrationService } from '../push-registration/push-registration.service';
import {
  getOrCreateInstallationId,
  PWA_ALERTS_ENABLED_KEY,
  PLANES_PUSH_SW_URL,
  urlBase64ToUint8Array,
} from './pwa-push.util';

export type PwaSubscribeResult =
  | 'subscribed'
  | 'disabled'
  | 'skipped'
  | 'denied'
  | 'unsupported';

@Injectable({ providedIn: 'root' })
export class PwaPushService {
  constructor(
    private http: HttpClient,
    private settings: SettingsService,
    private pushRegistration: PushRegistrationService,
  ) {}

  isPwaAlertsEnabledLocally(): boolean {
    return localStorage.getItem(PWA_ALERTS_ENABLED_KEY) === '1';
  }

  setPwaAlertsEnabledLocally(enabled: boolean): void {
    localStorage.setItem(PWA_ALERTS_ENABLED_KEY, enabled ? '1' : '0');
  }

  async subscribePwaAlerts(opts: {
    prompt?: boolean;
    pushoverFallback?: boolean;
    radiusKm?: number;
    ignoredTypes?: string[];
  } = {}): Promise<PwaSubscribeResult> {
    if (typeof Notification === 'undefined' || !navigator.serviceWorker) {
      return 'unsupported';
    }
    if (!('PushManager' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') {
      if (!opts.prompt) return 'skipped';
      const next = await Notification.requestPermission();
      if (next !== 'granted') return 'denied';
    }

    const registration = await navigator.serviceWorker.register(PLANES_PUSH_SW_URL, {
      updateViaCache: 'none',
    });
    if (!registration.pushManager) return 'unsupported';

    const vapid = await this.fetchVapidPublicKey();
    if (!vapid) return 'skipped';

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    });
    const json = subscription.toJSON();
    const p256dh = json.keys?.['p256dh'];
    const auth = json.keys?.['auth'];
    if (!json.endpoint || !p256dh || !auth) return 'skipped';

    const home = this.settings.getHomeLocation() ?? DEFAULT_PUSH_HOME;
    const installationId = getOrCreateInstallationId();
    const pushoverKey = this.pushRegistration.getStoredUserKey();
    const pushoverDevice = this.pushRegistration.getStoredPushoverDeviceName();
    const useFallback =
      opts.pushoverFallback === true &&
      Boolean(pushoverKey?.trim() && pushoverDevice?.trim());

    const stored = await this.registerOnServer({
      installationId,
      location: home,
      webPushSubscription: { endpoint: json.endpoint, keys: { p256dh, auth } },
      pwaNotificationsEnabled: true,
      radiusKm: opts.radiusKm ?? this.settings.radius ?? 100,
      distanceUnit: this.settings.distanceUnit === 'miles' ? 'miles' : 'km',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ignoredTypes: opts.ignoredTypes ?? [],
      platform: navigator.userAgent,
      ...(useFallback
        ? {
            pushoverUserKey: pushoverKey!.trim(),
            pushoverDeviceName: pushoverDevice!.trim(),
            pushoverFallbackEnabled: true,
          }
        : {}),
    });

    if (!stored) return 'skipped';
    this.setPwaAlertsEnabledLocally(true);
    return 'subscribed';
  }

  async confirmWebPushAsPrimary(): Promise<boolean> {
    const installationId = getOrCreateInstallationId();
    const home = this.settings.getHomeLocation() ?? DEFAULT_PUSH_HOME;
    return this.registerOnServer({
      installationId,
      location: home,
      pwaNotificationsEnabled: true,
      confirmWebPushChannel: true,
    });
  }

  async preferPushoverChannel(): Promise<boolean> {
    const installationId = getOrCreateInstallationId();
    const home = this.settings.getHomeLocation() ?? DEFAULT_PUSH_HOME;
    return this.registerOnServer({
      installationId,
      location: home,
      preferPushoverChannel: true,
    });
  }

  async disablePwaAlerts(): Promise<void> {
    const installationId = getOrCreateInstallationId();
    const home = this.settings.getHomeLocation() ?? DEFAULT_PUSH_HOME;
    await this.registerOnServer({
      installationId,
      location: home,
      pwaNotificationsEnabled: false,
    });
    this.setPwaAlertsEnabledLocally(false);
  }

  private async fetchVapidPublicKey(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ publicKey?: string }>(pwaVapidPublicKeyEndpoint),
      );
      return res.publicKey?.trim() || null;
    } catch {
      return null;
    }
  }

  private async registerOnServer(body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success?: boolean }>(pwaAlertsRegisterEndpoint, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return res.success === true;
    } catch {
      return false;
    }
  }
}
