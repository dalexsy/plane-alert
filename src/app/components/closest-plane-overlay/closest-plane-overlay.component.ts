import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { IconComponent } from '../ui/icon.component';
import { PlaneModel } from '../../models/plane-model';
import { haversineDistance } from '../../utils/geo-utils';
import {
  DistanceUnit,
  convertFromKm,
  getDistanceUnitShortLabel,
  formatDistance,
} from '../../utils/units.util';
import { SettingsService } from '../../services/settings.service';
import { DebouncedClickService } from '../../services/debounced-click.service';
import { TextUtils } from '../../utils/text-utils';

@Component({
  selector: 'app-closest-plane-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './closest-plane-overlay.component.html',
  styleUrls: ['./closest-plane-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosestPlaneOverlayComponent implements OnDestroy {
  @Input() plane: PlaneModel | null = null;
  private distanceUnitSubscription?: Subscription;

  constructor(
    private settings: SettingsService,
    private debounced: DebouncedClickService,
    private cdr: ChangeDetectorRef
  ) {
    // Subscribe to distance unit changes to trigger change detection
    this.distanceUnitSubscription = this.settings.distanceUnitChanged.subscribe(
      () => {
        this.cdr.markForCheck();
      }
    );
  }

  ngOnDestroy(): void {
    this.distanceUnitSubscription?.unsubscribe();
  } /** Distance computed dynamically from home location */
  get distanceKm(): number {
    if (!this.plane) {
      return 0;
    }
    const lat = this.settings.lat ?? 0;
    const lon = this.settings.lon ?? 0;
    const distanceInKm = haversineDistance(
      lat,
      lon,
      this.plane.lat,
      this.plane.lon
    );
    const unit = this.settings.distanceUnit as DistanceUnit;
    return Math.round(convertFromKm(distanceInKm, unit) * 10) / 10;
  }

  /** Get distance unit for display */
  get distanceUnit(): string {
    const unit = this.settings.distanceUnit as DistanceUnit;
    return getDistanceUnitShortLabel(unit);
  } /** Format distance with proper decimal separator (always period) */
  get formattedDistance(): string {
    return formatDistance(this.distanceKm);
  }
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.isSelected && this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.isSelected && this.plane?.isSpecial === true;
  }
  @Input() operator: string | null = null;
  @Input() secondsAway: number | null = null;
  @Input() velocity: number | null = null;
  @Input() isSelected: boolean = false;
  @Output() selectPlane =
    new EventEmitter<PlaneModel>(); /** Formatted ETA in #m #s format without suffix */
  get formattedEta(): string {
    if (this.secondsAway == null) {
      return '';
    }
    const m = Math.floor(this.secondsAway / 60);
    const s = this.secondsAway % 60;
    return `${m}m ${s}s`;
  }

  /** Handle user click to select this plane */
  onClick(): void {
    if (!this.plane) {
      return;
    }
    // Debounce clicks to prevent rapid duplicates
    const key = `closest-plane-${this.plane.icao}`;
    this.debounced.preventDuplicateClick(key, () => {
      this.selectPlane.emit(this.plane!);
    });
  }

  /** Truncate operator text to 30 characters with ellipsis if longer */
  truncateOperator(operator: string | undefined | null): string {
    return TextUtils.truncateOperator(operator);
  }
}
