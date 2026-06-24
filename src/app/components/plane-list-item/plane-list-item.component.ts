import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostBinding,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { SettingsService } from '../../services/settings.service';
import { AnnouncementService } from '../../services/announcement.service';
import { haversineDistance } from '../../utils/geo-utils';
import {
  DistanceUnit,
  convertFromKm,
  getDistanceUnitShortLabel,
} from '../../utils/units.util';
import { isPlaneAtClickedAirport } from '../../services/results/results-airport-match.util';
import { PlaneListItemTopComponent } from './plane-list-item-top/plane-list-item-top.component';
import { PlaneListItemBottomComponent } from './plane-list-item-bottom/plane-list-item-bottom.component';

@Component({
  selector: 'app-plane-list-item',
  standalone: true,
  imports: [CommonModule, PlaneListItemTopComponent, PlaneListItemBottomComponent],
  templateUrl: './plane-list-item.component.html',
  styleUrls: ['./plane-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaneListItemComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) plane!: PlaneLogEntry;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky';
  @Input() hoveredPlaneIcao: string | null = null;
  @Input() now = Date.now();
  @Input() activePlaneIcaos = new Set<string>();
  @Input() followedPlaneIcao: string | null = null;
  @Input() clickedAirports = new Set<number>();
  @Input() airportCircles = new Map<number, L.Circle>();

  @HostBinding('class.military-plane') get hostMilitary() {
    return this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.plane?.isSpecial === true;
  }
  @HostBinding('class.a380-plane') get hostA380() {
    return this.plane?.isA380 === true;
  }
  @HostBinding('class.new-plane') get hostNew() {
    return this.plane?.isNew === true;
  }
  @HostBinding('class.highlighted-plane') get hostHighlighted() {
    return this.plane.icao === this.highlightedPlaneIcao;
  }
  @HostBinding('class.followed-plane') get hostFollowed() {
    return this.plane.icao === this.followedPlaneIcao;
  }
  @HostBinding('class.airport-clicked') get hostAirportClicked() {
    return isPlaneAtClickedAirport(
      this.plane,
      this.clickedAirports,
      this.airportCircles
    );
  }
  @HostBinding('class.faded-out') get hostFadedOut() {
    return (
      !this.activePlaneIcaos.has(this.plane.icao) &&
      this.plane.icao !== this.followedPlaneIcao
    );
  }

  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();

  private distanceUnitSubscription?: Subscription;

  constructor(
    private settings: SettingsService,
    private announcementService: AnnouncementService,
    private cdr: ChangeDetectorRef
  ) {
    this.distanceUnitSubscription = this.settings.distanceUnitChanged.subscribe(
      () => this.cdr.markForCheck()
    );
  }

  get distanceKm(): number {
    const lat = this.settings.lat ?? 0;
    const lon = this.settings.lon ?? 0;
    if (this.plane.lat == null || this.plane.lon == null) return 0;
    const km = haversineDistance(lat, lon, this.plane.lat, this.plane.lon);
    const unit = this.settings.distanceUnit as DistanceUnit;
    return Math.round(convertFromKm(km, unit) * 10) / 10;
  }

  get distanceUnit(): string {
    return getDistanceUnitShortLabel(this.settings.distanceUnit as DistanceUnit);
  }

  ngOnDestroy(): void {
    this.distanceUnitSubscription?.unsubscribe();
  }

  @HostListener('click')
  onHostClick(): void {
    this.centerPlane.emit(this.plane);
  }

  onCenterPlane(event: Event): void {
    event.stopPropagation();
    this.centerPlane.emit(this.plane);
  }

  onCenterAirport(event: Event): void {
    event.stopPropagation();
    if (this.plane.airportLat != null && this.plane.airportLon != null) {
      this.centerAirport.emit({
        lat: this.plane.airportLat,
        lon: this.plane.airportLon,
      });
    }
  }

  onFilter(event: Event): void {
    event.stopPropagation();
    this.filterPrefix.emit(this.plane);
  }

  onToggleSpecial(event: Event): void {
    event.stopPropagation();
    this.toggleSpecial.emit(this.plane);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.plane.isNew) {
      this.announcementService.announceNewAircraft(this.plane, {
        isAirportClicked: this.hostAirportClicked,
      });
    }
  }
}
