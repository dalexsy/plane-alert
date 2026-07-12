import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_PUSH_HOME,
  PUSHOVER_USER_KEY,
} from '@plane-alert/shared';
import {
  pushCheckDeviceEndpoint,
  pushRegistrationEndpoint,
} from '../../config/firebase.config';
import { SettingsService } from '../settings/settings.service';

export interface PushRegistrationOptions {
  radiusKm?: number;
  distanceUnit?: 'km' | 'miles';
  ignoredTypes?: string[];
}

interface RegisterDeviceResponse {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  deviceName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseMessagingService {
  private readonly pushoverDeviceKey = 'plane-alert-pushover-device';
  private readonly pushoverKeyKey = 'plane-alert-pushover-key';
  private readonly deviceNameKey = 'plane-alert-device-name';

  constructor(private http: HttpClient, private settings: SettingsService) {}

  /**
   * Register with backend — device is inferred automatically from this browser.
   */
  async registerDevice(
    pushoverUserKey: string,
    options: PushRegistrationOptions = {}
  ): Promise<boolean> {
    if (!pushoverUserKey?.trim()) {
      return false;
    }

    const home = this.settings.getHomeLocation() ?? DEFAULT_PUSH_HOME;

    const clientModel = await this.readClientModel();
    const radius = options.radiusKm ?? this.settings.radius ?? 100;
    const distanceUnit =
      options.distanceUnit ??
      (this.settings.distanceUnit === 'miles' ? 'miles' : 'km');
    const payload = {
      pushoverUserKey: pushoverUserKey.trim(),
      platform: navigator.userAgent,
      clientModel,
      distanceUnit,
      radiusKm: typeof radius === 'number' ? radius : 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: home,
      specialIcaos: [] as string[],
      notifyProximity: false,
      ignoredTypes: options.ignoredTypes ?? [],
    };

    try {
      const result = await firstValueFrom(
        this.http.post<RegisterDeviceResponse>(pushRegistrationEndpoint, payload, {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      if (!result.success) {
        return false;
      }

      this.storeUserKey(pushoverUserKey.trim());
      if (result.deviceName) {
        this.storePushoverDeviceName(result.deviceName);
      }
      return true;
    } catch {
      return false;
    }
  }

  async fetchPushoverDevices(pushoverUserKey: string) {
    if (!pushoverUserKey?.trim()) {
      return null;
    }
    try {
      return await firstValueFrom(
        this.http.post<{
          availableDevices: string[];
        }>(
          pushCheckDeviceEndpoint,
          { pushoverUserKey: pushoverUserKey.trim() },
          { headers: { 'Content-Type': 'application/json' } }
        )
      );
    } catch {
      return null;
    }
  }

  getStoredUserKey(): string | null {
    const primary = localStorage.getItem(this.pushoverKeyKey);
    if (primary) {
      return primary;
    }

    for (const key of ['pushover-user-key', 'pushoverUserKey']) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        this.storeUserKey(legacy);
        return legacy;
      }
    }

    return PUSHOVER_USER_KEY;
  }

  getStoredPushoverDeviceName(): string | null {
    const stored = localStorage.getItem(this.pushoverDeviceKey);
    if (stored?.trim()) {
      return stored.trim();
    }
    const legacy = localStorage.getItem(this.deviceNameKey);
    return legacy?.trim() || null;
  }

  async updateHomeLocation(lat: number, lon: number): Promise<boolean> {
    const userKey = this.getStoredUserKey();
    if (!userKey) {
      return false;
    }

    return this.registerDevice(userKey);
  }

  private async readClientModel(): Promise<string | undefined> {
    try {
      const nav = navigator as Navigator & {
        userAgentData?: {
          getHighEntropyValues?: (
            hints: string[]
          ) => Promise<{ model?: string }>;
        };
      };
      const getValues = nav.userAgentData?.getHighEntropyValues;
      if (!getValues) {
        return undefined;
      }
      const hints = await getValues.call(nav.userAgentData, ['model']);
      return hints.model?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private storeUserKey(userKey: string): void {
    localStorage.setItem(this.pushoverKeyKey, userKey);
    localStorage.setItem('pushover-user-key', userKey);
  }

  private storePushoverDeviceName(deviceName: string): void {
    localStorage.setItem(this.pushoverDeviceKey, deviceName);
    localStorage.setItem(this.deviceNameKey, deviceName);
  }
}
