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
import { PlaneListItemComponent } from '../../plane-list-item/plane-list-item.component';
import type { PlaneLogEntry } from '../../../types/plane-log-entry';
import { resultsListAnimation } from '../results-list.animations';

@Component({
  selector: 'app-results-sky-list',
  standalone: true,
  imports: [CommonModule, PlaneListItemComponent],
  templateUrl: './results-sky-list.component.html',
  styleUrls: ['./results-sky-list.component.scss'],
  animations: [resultsListAnimation],
})
export class ResultsSkyListComponent {
  @Input({ required: true }) planes!: PlaneLogEntry[];
  @Input() loadingAirports = false;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() hoveredPlaneIcao: string | null = null;
  @Input() now = Date.now();
  @Input() activePlaneIcaos = new Set<string>();
  @Input() clickedAirports = new Set<number>();
  @Input() airportCircles = new Map<number, L.Circle>();
  @Input() animationsEnabled = true;
  @Input() scrollable = false;
  @Input() atBottom = false;
  @Output() scrollChange = new EventEmitter<Event>();
  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  @ViewChild('listEl') listRef!: ElementRef<HTMLDivElement>;

  trackByPlaneIcao(_index: number, plane: PlaneLogEntry): string {
    return plane.icao;
  }
}
