import { Injectable, ChangeDetectorRef } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { SettingsService } from '../settings.service';
import { ScanService } from '../scan.service';
import { LocationContextService } from '../location-context.service';
import { LocationUpdateService } from '../location-update.service';
import type { InputComponent } from '../../components/ui/input/input.component';
import {
  DistanceUnit,
  convertFromKm,
  convertToKm,
  formatDistance,
} from '../../utils/units.util';
import { formatScanCountdown } from './input-overlay-form.util';

@Injectable({ providedIn: 'root' })
export class InputOverlayFacadeService {
  collapsed = true;
  otherControlsHidden = false;
  currentAddress = '';
  scanButtonText = '';
  lastScanTime: Date | null = null;
  isUserEditingRadius = false;
  isUserEditingAddress = false;

  private sub?: Subscription;

  constructor(
    public settings: SettingsService,
    private scanService: ScanService,
    private locationContext: LocationContextService,
    public locationUpdate: LocationUpdateService
  ) {}

  init(cdr: ChangeDetectorRef, addressRef?: () => InputComponent | undefined): void {
    this.collapsed = this.settings.inputOverlayCollapsed;
    this.otherControlsHidden = this.settings.inputOverlayControlsHidden;
    this.settings.inputOverlayCollapsedChanged.subscribe((v) => {
      this.collapsed = v;
      cdr.detectChanges();
    });
    this.settings.inputOverlayControlsChanged.subscribe((v) => {
      this.otherControlsHidden = v;
      cdr.detectChanges();
    });
    this.locationContext.currentLocation$.subscribe((loc) => {
      if (!this.isUserEditingAddress) {
        this.currentAddress = loc.address;
        addressRef?.()?.setValue(loc.address);
        cdr.detectChanges();
      }
    });
    this.sub = combineLatest([
      this.scanService.countdown$,
      this.scanService.isActive$,
    ]).subscribe(([count, active]) => {
      this.scanButtonText = active
        ? `Update now (next update in ${formatScanCountdown(count)})`
        : 'Start scanning at location';
      cdr.detectChanges();
    });
  }

  destroy(): void {
    this.sub?.unsubscribe();
  }

  toggleCollapsed(cdr: ChangeDetectorRef): void {
    this.collapsed = !this.collapsed;
    this.settings.setInputOverlayCollapsed(this.collapsed);
    cdr.detectChanges();
  }

  toggleOtherControls(cdr: ChangeDetectorRef): void {
    this.otherControlsHidden = !this.otherControlsHidden;
    this.settings.setInputOverlayControlsHidden(this.otherControlsHidden);
    if (!this.otherControlsHidden && this.collapsed) this.toggleCollapsed(cdr);
    else if (this.otherControlsHidden && !this.collapsed) this.toggleCollapsed(cdr);
    cdr.detectChanges();
  }

  get displayRadiusValue(): string {
    const radiusKm = this.settings.radius ?? 5;
    const unit = this.settings.distanceUnit as DistanceUnit;
    const converted = convertFromKm(radiusKm, unit);
    const precise = Math.round(converted * 100) / 100;
    return formatDistance(Math.round(precise * 10) / 10);
  }

  get displayIntervalValue(): string {
    return this.settings.getFormattedIntervalDisplay();
  }

  processRadiusFromInput(inputValue: string): void {
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val > 0) {
      this.settings.setRadius(convertToKm(val, this.settings.distanceUnit as DistanceUnit));
    }
  }

  markScanTime(): void {
    this.lastScanTime = new Date();
  }

  clearAddress(cdr: ChangeDetectorRef): void {
    this.currentAddress = '';
    this.isUserEditingAddress = false;
    cdr.detectChanges();
  }

  get lastScanTimeText(): string {
    return this.lastScanTime?.toLocaleTimeString() ?? 'No scans yet';
  }

  get lastLocationUpdateText(): string {
    const last = this.locationUpdate.lastUpdateTime;
    if (!last) return 'Active';
    const diffMin = Math.floor((Date.now() - last.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} mins ago`;
    return last.toLocaleTimeString();
  }
}
