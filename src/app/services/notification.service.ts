import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import {
  DistanceUnit,
  convertFromKm,
  getDistanceUnitShortLabel,
  formatDistance,
} from '../utils/units.util';

export type NotificationState =
  | 'unsupported'
  | 'pwa-required'
  | 'prompt'
  | 'granted'
  | 'blocked'
  | 'incognito-blocked';

export interface NotificationStatusInfo {
  state: NotificationState;
  icon: string;
  label: string;
  details: string;
  canRequest: boolean;
  canTest: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private settings: SettingsService) {}

  /**
   * Request permission for browser notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.log('Permission already denied');
      return 'denied';
    }

    return Notification.requestPermission();
  }

  /**
   * Provide a normalized status object for the UI to render
   */
  async evaluateStatus(): Promise<NotificationStatusInfo> {
    if (!('Notification' in window)) {
      return {
        state: 'unsupported',
        icon: '❌',
        label: 'Notifications not supported',
        details: 'Your browser does not support the Notifications API.',
        canRequest: false,
        canTest: false,
      };
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      return {
        state: 'pwa-required',
        icon: '📲',
        label: 'Install to enable alerts',
        details:
          'Add PlaneAlert to your home screen to turn on notifications in iOS.',
        canRequest: false,
        canTest: false,
      };
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
      return {
        state: 'granted',
        icon: '✅',
        label: 'Notifications enabled',
        details: 'Ready to alert you when military planes are nearby.',
        canRequest: false,
        canTest: true,
      };
    }

    if (permission === 'denied') {
      const incognito = await this.detectIncognito();
      if (incognito) {
        return {
          state: 'incognito-blocked',
          icon: '🚫',
          label: 'Blocked in private window',
          details:
            'Chrome automatically blocks notifications in Incognito. Open PlaneAlert in a regular window to enable alerts.',
          canRequest: false,
          canTest: false,
        };
      }

      return {
        state: 'blocked',
        icon: '🚫',
        label: 'Notifications blocked',
        details:
          'Notifications are turned off for PlaneAlert. Enable them in the browser site settings, then tap the button again.',
        canRequest: true,
        canTest: false,
      };
    }

    return {
      state: 'prompt',
      icon: '🔔',
      label: 'Notifications available',
      details: 'Click the button below to enable military plane alerts.',
      canRequest: true,
      canTest: false,
    };
  }

  /**
   * Show a notification for a military plane
   */
  showMilitaryPlaneNotification(planeInfo: {
    icao: string;
    callsign?: string;
    model?: string;
    operator?: string;
    altitude?: number;
    speed?: number;
    direction?: string;
    distanceKm?: number;
  }): void {
    if (Notification.permission !== 'granted') {
      return;
    }

    const label =
      planeInfo.model?.trim() || planeInfo.callsign?.trim() || planeInfo.icao;
    const title = `${label || 'Plane'} peeped!`;
    const body = this.buildNotificationBody(planeInfo);
    const options: NotificationOptions = {
      body,
      icon: 'assets/favicon/military/favicon.ico',
      badge: 'assets/favicon/military/favicon.ico',
      tag: 'military-plane',
      requireInteraction: false,
      silent: false,
      data: {
        icao: planeInfo.icao,
        callsign: planeInfo.callsign,
        distanceKm: planeInfo.distanceKm,
      },
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) =>
          registration.showNotification(title, options).catch(() => {
            this.spawnWindowNotification(title, options);
          })
        )
        .catch(() => this.spawnWindowNotification(title, options));
    } else {
      this.spawnWindowNotification(title, options);
    }
  }

  private buildNotificationBody(planeInfo: {
    icao: string;
    callsign?: string;
    model?: string;
    operator?: string;
    direction?: string;
    distanceKm?: number;
  }): string {
    const unitPreference =
      this.settings.distanceUnit === 'miles'
        ? DistanceUnit.MILES
        : DistanceUnit.KILOMETERS;

    const direction = planeInfo.direction?.trim();
    const distanceKm = planeInfo.distanceKm;
    let lookSegment: string;

    if (distanceKm !== undefined) {
      const converted = convertFromKm(distanceKm, unitPreference);
      const formattedDistance = formatDistance(converted);
      const unitLabel = getDistanceUnitShortLabel(unitPreference);
      const distanceText = `${formattedDistance} ${unitLabel}`;
      lookSegment = direction
        ? `Look ${distanceText} ${direction}.`
        : `Look ${distanceText}.`;
    } else if (direction) {
      lookSegment = `Look ${direction}.`;
    } else {
      lookSegment = 'Look around.';
    }

    const callSign = this.resolveCallsign(planeInfo.callsign, planeInfo.icao);
    const country = this.extractCountry(planeInfo.operator);
    const callsign = this.resolveCallsign(planeInfo.callsign, planeInfo.icao);
    const fromSegment = `${callsign} from ${country}.`;

    return `${lookSegment} ${fromSegment}`.replace(/\s+/g, ' ').trim();
  }

  private resolveCallsign(callsign: string | undefined, icao: string): string {
    const primary = callsign?.trim();
    if (primary) {
      return primary;
    }
    return icao;
  }

  private extractCountry(operator?: string): string {
    if (!operator) {
      return 'unknown country';
    }

    let candidate = operator.trim();

    const parenMatch = candidate.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim().length > 2) {
      candidate = parenMatch[1].trim();
    }

    if (candidate.includes(' - ')) {
      candidate = candidate.split(' - ')[0].trim();
    }

    if (candidate.includes(',')) {
      const parts = candidate
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length) {
        candidate = parts[parts.length - 1];
      }
    }

    candidate = candidate.replace(/\s+/g, ' ').trim();

    return candidate.length > 1 ? candidate : operator.trim();
  }

  private spawnWindowNotification(
    title: string,
    options: NotificationOptions
  ): void {
    try {
      const notification = new Notification(title, options);
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.warn('Window notification failed:', error);
    }
  }

  private async detectIncognito(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return false;
    }

    try {
      const { quota } = await navigator.storage.estimate();
      // Chrome reports a much smaller quota in Incognito (~120 MB)
      return typeof quota === 'number' && quota > 0 && quota < 120_000_000;
    } catch {
      return false;
    }
  }
}
