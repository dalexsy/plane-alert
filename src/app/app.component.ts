import { Component, OnInit } from '@angular/core';
import { MapComponent } from './map/map.component';
import { CommonModule } from '@angular/common';
import { NoonRefreshService } from './services/noon-refresh.service';
import {
  NotificationService,
  NotificationStatusInfo,
} from './services/notification.service';
import { FirebaseMessagingService } from './services/firebase-messaging.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, MapComponent], // Import MapComponent and CommonModule
})
export class AppComponent implements OnInit {
  title = 'plane-alert';

  constructor(
    private noonRefreshService: NoonRefreshService,
    private notificationService: NotificationService,
    private firebaseMessaging: FirebaseMessagingService
  ) {}

  ngOnInit() {
    this.noonRefreshService.start();
    // Delay the notification check to allow service worker registration to complete
    setTimeout(() => this.checkNotificationSupport(), 2000);
  }

  private async checkNotificationSupport() {
    try {
      const status: NotificationStatusInfo =
        await this.notificationService.evaluateStatus();

      // Silently register if granted, no UI needed
      if (status.state === 'granted') {
        await this.ensurePushoverRegistration();
      }
    } catch (error) {
      console.warn('Notification status check failed:', error);
    }
  }

  private async ensurePushoverRegistration() {
    const storedKey = this.firebaseMessaging.getStoredUserKey();
    if (storedKey) {
      // Re-register with current settings
      await this.firebaseMessaging.registerDevice(storedKey);
      return;
    }

    // Prompt for Pushover user key
    const userKey = prompt(
      'Enter your Pushover User Key to enable notifications.\n\n' +
        'Find it at: https://pushover.net/\n' +
        '(You need the Pushover app installed)'
    );

    if (userKey && userKey.trim()) {
      const success = await this.firebaseMessaging.registerDevice(userKey);
      if (success) {
        alert(
          "✅ Notifications enabled! You'll receive alerts for military planes."
        );
      } else {
        alert(
          '❌ Failed to enable notifications. Check the console for details.'
        );
      }
    }
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
        });
      }, 1500);
      return;
    }

    if (permission === 'denied') {
      const browser = this.getBrowserLabel();
      alert(
        `Notifications are blocked in ${browser} for plane-alert-final.surge.sh.\n\n` +
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
