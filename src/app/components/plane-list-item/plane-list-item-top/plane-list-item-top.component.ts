import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../ui/button/button.component';
import { CountryService } from '../../../services/country.service';
import { PlaneStyleService } from '../../../services/plane-style.service';
import type { PlaneLogEntry } from '../../../types/plane-log-entry';

@Component({
  selector: 'app-plane-list-item-top',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './plane-list-item-top.component.html',
  styleUrls: ['./plane-list-item-top.component.scss'],
})
export class PlaneListItemTopComponent {
  @Input({ required: true }) plane!: PlaneLogEntry;
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky';
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() hoveredPlaneIcao: string | null = null;
  @Input() followedPlaneIcao: string | null = null;
  @Input() activePlaneIcaos = new Set<string>();
  @Input() distanceKm = 0;
  @Input() distanceUnit = 'km';
  @Input() now = Date.now();

  @Output() centerPlane = new EventEmitter<Event>();
  @Output() centerAirport = new EventEmitter<Event>();
  @Output() toggleSpecial = new EventEmitter<Event>();
  @Output() hoverPlane = new EventEmitter<void>();
  @Output() unhoverPlane = new EventEmitter<void>();

  constructor(
    public countryService: CountryService,
    public planeStyle: PlaneStyleService
  ) {}

  getTimeAgo(timestamp: number): string {
    const diff = Math.floor((this.now - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(minutes / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ${minutes % 60}m ago`;
  }

  showAirportBadge(): boolean {
    return (
      !!this.plane.airportName &&
      (this.plane.onGround === true ||
        (this.plane.altitude != null && this.plane.altitude <= 200))
    );
  }
}
