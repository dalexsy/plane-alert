import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { formatNotificationTitle, getCountryFlagEmoji } from '@plane-alert/shared';
import {
  buildMilitaryNotificationBody,
  evaluateNotificationStatus,
  MilitaryPlaneInfo,
  NotificationStatusInfo,
  spawnWindowNotification,
} from './notification.util';

export type { NotificationState, NotificationStatusInfo } from './notification.util';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private settings: SettingsService) {}

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  async evaluateStatus(): Promise<NotificationStatusInfo> {
    return evaluateNotificationStatus();
  }

  showMilitaryPlaneNotification(planeInfo: MilitaryPlaneInfo): void {
    if (Notification.permission !== 'granted') return;
    const flagEmoji = planeInfo.countryCode
      ? getCountryFlagEmoji(planeInfo.countryCode)
      : undefined;
    const title = formatNotificationTitle(
      flagEmoji,
      planeInfo.model,
      planeInfo.callsign,
      planeInfo.icao,
      planeInfo.operator
    );
    const body = buildMilitaryNotificationBody(planeInfo, this.settings);
    const notificationUrl = `${window.location.origin}/?icao=${planeInfo.icao}&follow=1`;
    const options: NotificationOptions = {
      body,
      icon: 'assets/favicon/military/favicon.ico',
      badge: 'assets/favicon/military/favicon.ico',
      tag: 'military-plane',
      requireInteraction: false,
      silent: false,
      data: { icao: planeInfo.icao, callsign: planeInfo.callsign, distanceKm: planeInfo.distanceKm, link: notificationUrl },
    };
    spawnWindowNotification(title, options);
  }
}
