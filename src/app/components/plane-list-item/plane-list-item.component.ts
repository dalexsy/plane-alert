// src/app/components/plane-list-item/plane-list-item.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  // Add HostBinding for dynamic classes
  HostBinding,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaneLogEntry } from '../results-overlay/results-overlay.component'; // Adjust path if needed
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SettingsService } from '../../services/settings.service';
import { ButtonComponent } from '../ui/button.component'; // Assuming ButtonComponent is standalone
import { haversineDistance } from '../../utils/geo-utils';

@Component({
  selector: 'app-plane-list-item',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './plane-list-item.component.html',
  styleUrls: ['./plane-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Use OnPush for performance
})
export class PlaneListItemComponent {
  constructor(
    public countryService: CountryService,
    public planeFilter: PlaneFilterService,
    private settings: SettingsService
  ) {}
  /** Distance from center, in km rounded to nearest tenth */
  get distanceKm(): number {
    const lat = this.settings.lat ?? 0;
    const lon = this.settings.lon ?? 0;
    if (this.plane.lat == null || this.plane.lon == null) return 0;
    return (
      Math.round(
        haversineDistance(lat, lon, this.plane.lat, this.plane.lon) * 10
      ) / 10
    );
  }

  @Input({ required: true }) plane!: PlaneLogEntry;
  // Reflect military/special state on host element for styling
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.plane?.isSpecial === true;
  }
  @HostBinding('class.new-plane') get hostNew() {
    return this.plane?.isNew === true;
  }
  @Input() highlightedPlaneIcao: string | null = null;
  @HostBinding('class.highlighted-plane')
  get hostHighlighted(): boolean {
    return this.plane.icao === this.highlightedPlaneIcao;
  }
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky'; // Default or require
  @Input() hoveredPlaneIcao: string | null = null; // For special icon hover
  @Input() now: number = Date.now();
  @Input() activePlaneIcaos: Set<string> = new Set();
  @Input() followedPlaneIcao: string | null = null;
  @HostBinding('class.followed-plane')
  get hostFollowed(): boolean {
    return this.plane.icao === this.followedPlaneIcao;
  }
  @HostBinding('class.faded-out')
  get hostFadedOut(): boolean {
    // Only fade out if not followed
    return (
      !this.activePlaneIcaos.has(this.plane.icao) &&
      this.plane.icao !== this.followedPlaneIcao
    );
  }

  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  // Keep hover/unhover in parent for simplicity for now

  // Keep getTimeAgo logic here as it's specific to the 'seen' variant display
  getTimeAgo(timestamp: number): string {
    const diff = Math.floor((this.now - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(minutes / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ${minutes % 60}m ago`;
  }

  // --- Event Handlers ---
  onCenterPlane(event: Event): void {
    event.stopPropagation(); // Prevent triggering other clicks if nested
    this.centerPlane.emit(this.plane);
  }

  onCenterPlaneMouseEnter(): void {
    this.hoverPlane.emit(this.plane);
  }

  onCenterPlaneMouseLeave(): void {
    this.unhoverPlane.emit(this.plane);
  }

  onFilter(event: Event): void {
    event.stopPropagation();
    this.filterPrefix.emit(this.plane);
  }

  onToggleSpecial(event: Event): void {
    event.stopPropagation();
    this.toggleSpecial.emit(this.plane);
  }
}
