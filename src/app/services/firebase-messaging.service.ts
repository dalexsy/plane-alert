import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { pushRegistrationEndpoint } from '../config/firebase.config';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class FirebaseMessagingService {
  private readonly deviceNameKey = 'plane-alert-device-name';

  constructor(
    private http: HttpClient,
    private settings: SettingsService,
  ) {}

  /**
   * Register Pushover user key with backend
   */
  async registerDevice(pushoverUserKey: string): Promise<boolean> {
    if (!pushoverUserKey || !pushoverUserKey.trim()) {
      console.warn('Pushover user key is required');
      return false;
    }

    const home = this.settings.getHomeLocation();
    if (!home) {
      console.error(
        '❌ No home location set. Double-tap the map to set your location before enabling notifications.',
      );
      alert(
        'Please set your home location first:\n\n' +
          '1. Double-tap on the map at your location\n' +
          '2. Then try enabling notifications again',
      );
      return false;
    }

    const radius = this.settings.radius ?? 100;
    const deviceName = this.getOrCreateDeviceName();
    const payload = {
      pushoverUserKey: pushoverUserKey.trim(),
      platform: navigator.userAgent,
      distanceUnit: this.settings.distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: typeof radius === 'number' ? radius : 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: home,
      deviceName,
      specialIcaos: [],
      notifyProximity: false,
      ignoredTypes: [],
    };

    try {
      await firstValueFrom(
        this.http.post(pushRegistrationEndpoint, payload, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      localStorage.setItem('plane-alert-pushover-key', pushoverUserKey.trim());
      try {
        localStorage.setItem(this.deviceNameKey, deviceName);
      } catch (err) {
        console.debug('Unable to persist device name', err);
      }
      console.log('✅ Registered Pushover user key with backend.');
      return true;
    } catch (error) {
      console.warn('Failed to register Pushover user key with backend:', error);
      return false;
    }
  }

  /**
   * Get stored Pushover user key
   */
  getStoredUserKey(): string | null {
    return localStorage.getItem('plane-alert-pushover-key');
  }

  /**
   * Check if there's an active push notification token
   */
  hasActiveToken(): boolean {
    return !!this.getStoredUserKey();
  }

  /**
   * Update current location in backend for proximity notifications
   */
  async updateCurrentLocation(lat: number, lon: number): Promise<boolean> {
    const userKey = this.getStoredUserKey();
    if (!userKey) {
      console.log('⏭️ No user key stored, skipping location update');
      return false;
    }

    console.log('📍 Updating backend location:', { lat, lon });

    const radius = this.settings.radius ?? 100;
    const deviceName = this.getOrCreateDeviceName();
    const payload = {
      pushoverUserKey: userKey,
      platform: navigator.userAgent,
      distanceUnit: this.settings.distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: typeof radius === 'number' ? radius : 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: { lat, lon },
      deviceName,
    };

    try {
      await firstValueFrom(
        this.http.post(pushRegistrationEndpoint, payload, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      console.log('✅ Backend location updated successfully:', { lat, lon });
      return true;
    } catch (error) {
      console.error('❌ Failed to update backend location:', error);
      return false;
    }
  }

  private getOrCreateDeviceName(): string {
    if (typeof window === 'undefined') {
      return 'browser-device';
    }

    const stored = localStorage.getItem(this.deviceNameKey);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }

    const generated = this.generateDefaultDeviceName();
    try {
      localStorage.setItem(this.deviceNameKey, generated);
    } catch (err) {
      console.debug('Unable to persist generated device name', err);
    }
    return generated;
  }

  private generateDefaultDeviceName(): string {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const platform =
      ((nav as any)?.userAgentData?.platform as string | undefined) ||
      nav?.platform ||
      '';
    const userAgent = nav?.userAgent || '';
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const base = isMobile ? 'mobile' : 'browser';
    const raw = `${base}-${platform || 'device'}`;
    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return normalized || `${base}-device`;
  }
}
