import { Injectable, ChangeDetectorRef } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { LocationContextService } from '../location-context/location-context.service';
import { LocationUpdateService } from '../location-update/location-update.service';
import type { InputComponent } from '../../components/ui/input/input.component';
import {
  DistanceUnit,
  convertFromKm,
  convertToKm,
  formatDistance,
} from '../../utils/units/units.util';
@Injectable({ providedIn: 'root' })
export class InputOverlayFacadeService {
  collapsed = true;
  otherControlsHidden = false;
  currentAddress = '';
  lastScanTime: Date | null = null;
  isUserEditingRadius = false;
  isUserEditingAddress = false;

  constructor(
    public settings: SettingsService,
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
  }

  destroy(): void {}

  toggleCollapsed(cdr: ChangeDetectorRef): void {
    this.collapsed = !this.collapsed;
    this.settings.setInputOverlayCollapsed(this.collapsed);
    // Opening the panel always shows the left icon rail (never leave form open with icons hidden)
    if (!this.collapsed && this.otherControlsHidden) {
      this.otherControlsHidden = false;
      this.settings.setInputOverlayControlsHidden(false);
    }
    // Mobile: one expanded panel at a time — settings vs results
    if (
      !this.collapsed &&
      typeof window !== 'undefined' &&
      window.innerWidth <= 600
    ) {
      this.settings.setResultsOverlayCollapsed(true);
    }
    cdr.detectChanges();
  }

  toggleOtherControls(cdr: ChangeDetectorRef): void {
    this.otherControlsHidden = !this.otherControlsHidden;
    this.settings.setInputOverlayControlsHidden(this.otherControlsHidden);
    // Show controls → open panel; hide controls → collapse panel (map space)
    if (!this.otherControlsHidden && this.collapsed) this.toggleCollapsed(cdr);
    else if (this.otherControlsHidden && !this.collapsed) {
      this.collapsed = true;
      this.settings.setInputOverlayCollapsed(true);
    }
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
