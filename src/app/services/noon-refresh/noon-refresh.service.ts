import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NoonRefreshService implements OnDestroy {
  private midnightRefreshTimer?: number;
  private dailyRefreshInterval?: number;
  private isActive = false;

  start(): void {
    if (this.isActive) {
      console.warn('Noon refresh service is already active');
      return;
    }

    this.setupNoonRefresh();
    this.isActive = true;
  }

  stop(): void {
    this.clearTimers();
    this.isActive = false;
  }

  get active(): boolean {
    return this.isActive;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private setupNoonRefresh(): void {
    const now = new Date();
    const today = new Date(now);
    today.setHours(12, 0, 0, 0);

    const targetTime =
      today.getTime() < now.getTime()
        ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
        : today;

    const timeUntilNoon = targetTime.getTime() - now.getTime();

    this.midnightRefreshTimer = window.setTimeout(() => {
      void this.performRefresh('noon');
    }, timeUntilNoon);

    this.dailyRefreshInterval = window.setInterval(() => {
      void this.performRefresh('daily noon');
    }, 24 * 60 * 60 * 1000);
  }

  private async performRefresh(_type: string): Promise<void> {
    await this.clearServiceWorkers();

    // Keep ?kiosk=1 (and other query params) — dropping them forces a full non-kiosk reload.
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.replace(url.toString());
  }

  private async clearServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  private clearTimers(): void {
    if (this.midnightRefreshTimer) {
      clearTimeout(this.midnightRefreshTimer);
      this.midnightRefreshTimer = undefined;
    }
    if (this.dailyRefreshInterval) {
      clearInterval(this.dailyRefreshInterval);
      this.dailyRefreshInterval = undefined;
    }
  }
}
