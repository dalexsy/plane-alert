// src/app/components/plane-list-item/plane-list-item.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaneLogEntry } from '../results-overlay/results-overlay.component'; // Adjust path if needed
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { ButtonComponent } from '../ui/button.component'; // Assuming ButtonComponent is standalone

@Component({
  selector: 'app-plane-list-item',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './plane-list-item.component.html',
  styleUrls: ['./plane-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Use OnPush for performance
})
export class PlaneListItemComponent {
  @Input({ required: true }) plane!: PlaneLogEntry;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky'; // Default or require
  @Input() hoveredPlaneIcao: string | null = null; // For special icon hover
  @Input() now: number = Date.now(); // Pass current time for 'time ago'

  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  // Keep hover/unhover in parent for simplicity for now

  constructor(
    public countryService: CountryService,
    public planeFilter: PlaneFilterService
  ) {}

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

  onFilter(event: Event): void {
    event.stopPropagation();
    this.filterPrefix.emit(this.plane);
  }

  onToggleSpecial(event: Event): void {
    event.stopPropagation();
    this.toggleSpecial.emit(this.plane);
  }
}
