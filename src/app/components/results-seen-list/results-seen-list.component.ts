import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ButtonComponent } from '../ui/button/button.component';
import { PlaneListItemComponent } from '../plane-list-item/plane-list-item.component';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { resultsListAnimation } from '../results-overlay/results-list.animations';

@Component({
  selector: 'app-results-seen-list',
  standalone: true,
  imports: [CommonModule, ButtonComponent, PlaneListItemComponent],
  templateUrl: './results-seen-list.component.html',
  styleUrls: ['./results-seen-list.component.scss'],
  animations: [resultsListAnimation],
})
export class ResultsSeenListComponent {
  @Input({ required: true }) seenLog!: PlaneLogEntry[];
  @Input({ required: true }) filteredLog!: PlaneLogEntry[];
  @Input() collapsed = true;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() hoveredPlaneIcao: string | null = null;
  @Input() now = Date.now();
  @Input() activePlaneIcaos = new Set<string>();
  @Input() clickedAirports = new Set<number>();
  @Input() airportCircles = new Map<number, L.Circle>();
  @Input() scrollable = false;
  @Input() atBottom = false;
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() clearHistorical = new EventEmitter<void>();
  @Output() scrollChange = new EventEmitter<Event>();
  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  @ViewChild('listEl') listRef!: ElementRef<HTMLDivElement>;
}
