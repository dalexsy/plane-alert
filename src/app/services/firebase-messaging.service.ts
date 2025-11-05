import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { pushRegistrationEndpoint } from '../config/firebase.config';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class FirebaseMessagingService {
  constructor(private http: HttpClient, private settings: SettingsService) {}

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
      console.warn(
        'Home location unavailable; cannot register push notifications.'
      );
      return false;
    }

    const radius = this.settings.radius ?? 100;
    const payload = {
      pushoverUserKey: pushoverUserKey.trim(),
      platform: navigator.userAgent,
      distanceUnit: this.settings.distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: typeof radius === 'number' ? radius : 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      home,
    };

    try {
      await firstValueFrom(
        this.http.post(pushRegistrationEndpoint, payload, {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      localStorage.setItem('plane-alert-pushover-key', pushoverUserKey.trim());
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
   * Update home location in backend (silent update, no need for full re-registration)
   */
  async updateHomeLocation(lat: number, lon: number): Promise<boolean> {
    const userKey = this.getStoredUserKey();
    if (!userKey) {
      // Not registered yet, skip
      return false;
    }

    const radius = this.settings.radius ?? 100;
    const payload = {
      pushoverUserKey: userKey,
      platform: navigator.userAgent,
      distanceUnit: this.settings.distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: typeof radius === 'number' ? radius : 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      home: { lat, lon },
    };

    try {
      await firstValueFrom(
        this.http.post(pushRegistrationEndpoint, payload, {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      console.log('✅ Updated backend location:', { lat, lon });
      return true;
    } catch (error) {
      console.warn('Failed to update backend location:', error);
      return false;
    }
  }
}
