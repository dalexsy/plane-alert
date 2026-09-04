import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NoonRefreshService } from './services/noon-refresh/noon-refresh.service';
import {
  NotificationService,
  NotificationStatusInfo,
} from './services/notification/notification.service';
import { PushRegistrationService } from './services/push-registration/push-registration.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, RouterOutlet],
})
export class AppComponent implements OnInit {
  title = 'plane-alert';

  constructor(
    private noonRefreshService: NoonRefreshService,
    private notificationService: NotificationService,
    private pushRegistration: PushRegistrationService
  ) {}

  ngOnInit() {
    this.noonRefreshService.start();
    // Pushover alerts are server-side — re-register whenever we have a stored key.
    setTimeout(() => this.syncPushoverRegistration(), 2000);
    setTimeout(() => this.checkNotificationSupport(), 2000);
  }

  private async syncPushoverRegistration(): Promise<void> {
    try {
      await this.pushRegistration.registerDevice(
        this.pushRegistration.getStoredUserKey()!
      );
    } catch (error) {
      console.warn('Pushover registration sync failed:', error);
    }
  }

  private async checkNotificationSupport() {
    try {
      await this.notificationService.evaluateStatus();
    } catch (error) {
      console.warn('Notification status check failed:', error);
    }
  }

  private async ensurePushoverRegistration() {
    await this.pushRegistration.registerDevice(
      this.pushRegistration.getStoredUserKey()!
    );
  }

  async requestNotificationPermission() {
    const permission = await this.notificationService.requestPermission();
    await this.checkNotificationSupport();

    if (permission === 'granted') {
      await this.ensurePushoverRegistration();
      setTimeout(() => {
        this.notificationService.showMilitaryPlaneNotification({
          icao: 'TEST123',
          callsign: 'TESTFLIGHT',
          model: 'Test Aircraft',
          operator: 'Test Operator',
          altitude: 10000,
          speed: 500,
          direction: 'NW',
          distanceKm: 4.2,
          origin: 'US',
          verticalRate: 128,
        });
      }, 1500);
      return;
    }

    if (permission === 'denied') {
      const browser = this.getBrowserLabel();
      alert(
        `Notifications are blocked in ${browser} for planes.dryl.io.\n\n` +
          'Open the site information panel, allow notifications, then tap Enable notifications again.'
      );
    } else if (permission === 'default') {
      alert(
        'Notification prompt was dismissed. Tap Enable notifications again when you are ready to allow alerts.'
      );
    }
  }

  async sendTestNotification() {
    if (Notification.permission === 'granted') {
      this.notificationService.showMilitaryPlaneNotification({
        icao: 'TEST123',
        callsign: 'TESTFLIGHT',
        model: 'Test Aircraft',
        operator: 'Test Operator',
        altitude: 10000,
        speed: 500,
        direction: 'NW',
        distanceKm: 4.2,
        origin: 'US',
        verticalRate: 128,
      });
      alert('Test notification sent! Check your notifications.');
    } else {
      await this.checkNotificationSupport();
    }
  }

  private getBrowserLabel(): string {
    const ua = navigator.userAgent;
    if (/edg/i.test(ua)) {
      return 'Microsoft Edge';
    }
    if (/chrome|crios|crmo/i.test(ua) && !/edg/i.test(ua)) {
      return 'Google Chrome';
    }
    if (/safari/i.test(ua) && !/chrome|crios|crmo|edg/i.test(ua)) {
      return 'Safari';
    }
    if (/firefox|fxios/i.test(ua)) {
      return 'Firefox';
    }
    return 'your browser';
  }
}
