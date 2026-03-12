import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NoonRefreshService implements OnDestroy {
  private midnightRefreshTimer?: number;
  private dailyRefreshInterval?: number;
  private isActive = false;

  /**
   * Starts the noon refresh functionality
   * Sets up a timer to refresh the page at noon and then daily thereafter
   */
  start(): void {
    if (this.isActive) {
      console.warn('Noon refresh service is already active');
      return;
    }

    this.setupNoonRefresh();
    this.isActive = true;
  }

  /**
   * Stops the noon refresh functionality
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

  private setupNoonRefresh(): void {
    const now = new Date();
    const today = new Date(now);
    today.setHours(12, 0, 0, 0); // Set to noon (12:00 PM)

    // If noon has already passed today, schedule for tomorrow's noon
    const targetTime =
      today.getTime() < now.getTime()
        ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
        : today;

    const timeUntilNoon = targetTime.getTime() - now.getTime();

    // Set timer for the first noon refresh
    this.midnightRefreshTimer = window.setTimeout(() => {
      this.performRefresh('noon');
    }, timeUntilNoon);

    // Set up daily recurring refresh (24 hours = 24 * 60 * 60 * 1000 ms)
    this.dailyRefreshInterval = window.setInterval(
      () => {
        this.performRefresh('daily noon');
      },
      24 * 60 * 60 * 1000,
    );
  }

  private performRefresh(type: string): void {
    console.log(`Performing ${type} refresh...`);

    // Unregister service worker before refresh to ensure clean state
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          Promise.all(registrations.map((reg) => reg.unregister())).then(() => {
            // Use location.reload() for a cleaner refresh that properly re-initializes everything
            window.location.reload();
          });
        })
        .catch((err) => {
          console.warn(
            'Service worker cleanup failed, forcing reload anyway:',
            err,
          );
          window.location.reload();
        });
    } else {
      window.location.reload();
    }
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
