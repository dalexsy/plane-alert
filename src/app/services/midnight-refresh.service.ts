import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MidnightRefreshService implements OnDestroy {
  private midnightRefreshTimer?: number;
  private dailyRefreshInterval?: number;
  private isActive = false;

  /**
   * Starts the midnight refresh functionality
   * Sets up a timer to refresh the page at midnight and then daily thereafter
   */
  start(): void {
    if (this.isActive) {
      console.warn('Midnight refresh service is already active');
      return;
    }

    this.setupMidnightRefresh();
    this.isActive = true;
  }

  /**
   * Stops the midnight refresh functionality
   * Clears all timers and intervals
   */
  stop(): void {
    this.clearTimers();
    this.isActive = false;
  }

  /**
   * Returns whether the service is currently active
   */
  get active(): boolean {
    return this.isActive;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private setupMidnightRefresh(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    const minutesUntilMidnight = Math.round(timeUntilMidnight / 1000 / 60);

    console.log(`Midnight Refresh Service: Auto-refresh scheduled for midnight (${minutesUntilMidnight} minutes from now)`);

    // Set timer for the first midnight refresh
    this.midnightRefreshTimer = window.setTimeout(() => {
      this.performRefresh('midnight');
    }, timeUntilMidnight);

    // Set up daily recurring refresh (24 hours = 24 * 60 * 60 * 1000 ms)
    this.dailyRefreshInterval = window.setInterval(() => {
      this.performRefresh('daily midnight');
    }, 24 * 60 * 60 * 1000);
  }

  private performRefresh(type: string): void {
    console.log(`Midnight Refresh Service: Performing ${type} refresh...`);
    // Force a hard refresh like F5 - bypasses cache and reloads everything
    // Add timestamp to force cache bypass
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.href = url.toString();
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
