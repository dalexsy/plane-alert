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
      console.log('[ScanService] Executing pending force scan after start');
      this.scanCallback();
    }

    this.tickSub = interval(1000).subscribe(() => {
      this.current--;
      this.countdownSubject.next(this.current);
      if (this.current <= 0) {
        console.log('[ScanService] Timer reached 0, running scanCallback');
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
    if (!this.scanCallback) {
      // Store that we need to do a scan as soon as a callback is registered
      this.pendingForceScan = true;
      console.log(
        '[ScanService] forceScan called before scanCallback registered, pendingForceScan set'
      );
      return;
    }
    console.log('[ScanService] forceScan called, running scanCallback');
    this.scanCallback();
    this.current = this.intervalSeconds;
    this.countdownSubject.next(this.current);
  }

  updateInterval(newSeconds: number): void {
    this.intervalSeconds = newSeconds;
    if (this.tickSub) {
      this.stop();
      this.start(this.intervalSeconds, this.scanCallback!);
    }
  }
}
