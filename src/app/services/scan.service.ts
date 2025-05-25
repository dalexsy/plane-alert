/* src/app/services/scan.service.ts */
import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScanService {
  private countdownSubject = new BehaviorSubject<number>(0);
  private activeSubject = new BehaviorSubject<boolean>(false);
  private tickSub: Subscription | null = null;
  private scanCallback: (() => void) | null = null;
  private intervalSeconds = 60;
  private current = 0;
  private pendingForceScan = false;

  get countdown$() {
    return this.countdownSubject.asObservable();
  }

  get isActive$() {
    return this.activeSubject.asObservable();
  }

  start(seconds: number, onScan: () => void): void {
    if (this.tickSub) {
      return;
    }
    this.intervalSeconds = seconds;
    this.scanCallback = onScan;
    this.current = this.intervalSeconds;
    this.countdownSubject.next(this.current);
    this.activeSubject.next(true);

    // If there was a pending force scan, do it now
    if (this.pendingForceScan && this.scanCallback) {
      this.pendingForceScan = false;
      this.scanCallback();
    }

    this.tickSub = interval(1000).subscribe(() => {
      this.current--;
      this.countdownSubject.next(this.current);
      if (this.current <= 0) {
        this.scanCallback?.();
        this.current = this.intervalSeconds;
        this.countdownSubject.next(this.current);
      }
    });
  }

  stop(): void {
    if (!this.tickSub) {
      return;
    }
    this.tickSub.unsubscribe();
    this.tickSub = null;
    this.activeSubject.next(false);
  }

  forceScan(): void {
    if (this.scanCallback) {
      this.scanCallback();
    } else {
      this.pendingForceScan = true; // Set flag if callback not yet available
    }
  }

  updateInterval(newSeconds: number): void {
    this.intervalSeconds = newSeconds;
    if (this.tickSub) {
      this.stop();
      this.start(this.intervalSeconds, this.scanCallback!);
    }
  }
}
