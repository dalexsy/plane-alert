import { Injectable } from '@angular/core';

/**
 * Performance monitoring service to detect and adapt to low-power devices
 */
@Injectable({
  providedIn: 'root',
})
export class PerformanceService {
  private readonly PERFORMANCE_KEY = 'plane-alert-performance-mode';
  private _isLowPowerMode: boolean = false;
  private _deviceScore: number = 100;

  constructor() {
    this.detectPerformance();
  }

  /**
   * Detect device performance and enable low-power mode if needed
   */
  private detectPerformance(): void {
    // Check if user manually set performance mode
    const savedMode = localStorage.getItem(this.PERFORMANCE_KEY);
    if (savedMode === 'low') {
      this._isLowPowerMode = true;
      console.log('🐌 Low-power mode enabled (manual setting)');
      return;
    }

    let score = 100;

    // Check CPU cores (Raspberry Pi typically has 4 cores)
    if ('hardwareConcurrency' in navigator) {
      const cores = navigator.hardwareConcurrency || 4;
      if (cores <= 4) {
        score -= 20;
      }
    }

    // Check device memory (Raspberry Pi 4 has 1-8GB, but limits to ~750MB per tab)
    if ('deviceMemory' in navigator) {
      const memory = (navigator as any).deviceMemory || 4;
      if (memory <= 2) {
        score -= 30;
      }
    }

    // Check connection type (slower connections might indicate mobile/edge devices)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        if (
          connection.effectiveType === '3g' ||
          connection.effectiveType === '2g'
        ) {
          score -= 15;
        }
        if (connection.saveData) {
          score -= 20;
        }
      }
    }

    // Check if running in PWA mode (often on mobile/low-power devices)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      score -= 10;
    }

    // Check user agent for known low-power devices
    const ua = navigator.userAgent.toLowerCase();
    if (
      ua.includes('raspbian') ||
      ua.includes('armv7') ||
      ua.includes('raspberry')
    ) {
      score -= 40;
      console.log('🍓 Raspberry Pi detected');
    }

    // Enable low-power mode if score is low
    this._deviceScore = score;
    this._isLowPowerMode = score < 50;

    if (this._isLowPowerMode) {
      console.log(
        `🐌 Low-power mode auto-enabled (device score: ${score}/100)`,
      );
      console.log('   Animations will be throttled to improve performance');
    } else {
      console.log(`⚡ High-performance mode (device score: ${score}/100)`);
    }
  }

  /**
   * Check if device is in low-power mode
   */
  get isLowPowerMode(): boolean {
    return this._isLowPowerMode;
  }

  /**
   * Get device performance score (0-100)
   */
  get deviceScore(): number {
    return this._deviceScore;
  }

  /**
   * Manually enable/disable low-power mode
   */
  setLowPowerMode(enabled: boolean): void {
    this._isLowPowerMode = enabled;
    localStorage.setItem(this.PERFORMANCE_KEY, enabled ? 'low' : 'high');
    console.log(
      `🔄 Low-power mode ${enabled ? 'enabled' : 'disabled'} manually`,
    );

    // Reload to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  /**
   * Get recommended RAF throttle (ms between frames)
   * Returns 0 for no throttle (60fps), or delay in ms
   */
  get rafThrottle(): number {
    if (!this._isLowPowerMode) return 0;

    // Throttle to 15fps on low-power devices (every 4th frame)
    return 66; // ~15fps
  }

  /**
   * Should disable decorative animations entirely
   */
  get disableDecorativeAnimations(): boolean {
    return this._isLowPowerMode;
  }
}
