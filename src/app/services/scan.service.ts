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
      console.log(
        'ScanService is already running. Stop it before starting again.'
      );
      return;
    }
    this.intervalSeconds = seconds;
    this.scanCallback = onScan;
    this.current = this.intervalSeconds;
    this.countdownSubject.next(this.current);
    this.activeSubject.next(true);

    // If there was a pending force scan, do it now
    if (this.pendingForceScan && this.scanCallback) {
      console.log('Executing pending forced scan');
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
        console.log('Scan executed, resetting countdown');
      }
    });

    console.log('Scan service started with interval', seconds);
  }

  stop(): void {
    if (!this.tickSub) {
      console.log('ScanService is not running. Nothing to stop.');
      return;
    }
    this.tickSub.unsubscribe();
    this.tickSub = null;
    this.activeSubject.next(false);
    console.log('Scan service stopped');
  }

  forceScan(): void {
    if (!this.scanCallback) {
      console.log('No scan callback defined. Cannot force scan.');
      // Store that we need to do a scan as soon as a callback is registered
      this.pendingForceScan = true;
      return;
    }
    this.scanCallback();
    this.current = this.intervalSeconds;
    this.countdownSubject.next(this.current);
    console.log('Forced scan triggered');
  }

  updateInterval(newSeconds: number): void {
    this.intervalSeconds = newSeconds;
    if (this.tickSub) {
      this.stop();
      this.start(this.intervalSeconds, this.scanCallback!);
    }
    console.log('Updated scan interval to', newSeconds);
  }
}
