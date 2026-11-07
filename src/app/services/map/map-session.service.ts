import { Injectable } from '@angular/core';
import { NoonRefreshService } from '../noon-refresh/noon-refresh.service';
import { NotificationService } from '../notification/notification.service';
import { PushRegistrationService } from '../push-registration/push-registration.service';

/** Map-only startup. Kept off the app shell so sightings does not pull the map graph. */
@Injectable({ providedIn: 'root' })
export class MapSessionService {
  constructor(
    private noonRefresh: NoonRefreshService,
    private notifications: NotificationService,
    private pushRegistration: PushRegistrationService,
  ) {}

  start(): void {
    this.noonRefresh.start();
    setTimeout(() => void this.syncPushoverRegistration(), 2000);
    setTimeout(() => void this.checkNotificationSupport(), 2000);
  }

  private async syncPushoverRegistration(): Promise<void> {
    try {
      await this.pushRegistration.registerDevice(
        this.pushRegistration.getStoredUserKey()!,
      );
    } catch (error) {
      console.warn('Pushover registration sync failed:', error);
    }
  }

  private async checkNotificationSupport(): Promise<void> {
    try {
      await this.notifications.evaluateStatus();
    } catch (error) {
      console.warn('Notification status check failed:', error);
    }
  }
}
