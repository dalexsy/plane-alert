/**
 * Map Overlays Component
 * Handles all overlay elements for the map like plane markers, paths, and visual indicators
 */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Types for the component interfaces
export interface PlaneDataState {
  planes: any[];
  isLoading: boolean;
  lastUpdated: number;
}

export interface EnvironmentalData {
  isLoading: boolean;
  weather?: any;
  astronomical?: any;
}

export interface UIState {
  showTrails: boolean;
  showPredictedPaths: boolean;
  showAltitudeColors: boolean;
}

export interface FollowState {
  followedPlaneIcao: string | null;
  isActive: boolean;
}

export interface PlaneSelectionEvent {
  icao: string;
  action: 'center' | 'follow' | 'info';
}

export interface LocationChangeEvent {
  lat: number;
  lon: number;
  radius?: number;
  zoom?: number;
}

@Component({
  selector: 'app-map-overlays',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-overlays.component.html',
  styleUrls: ['./map-overlays.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapOverlaysComponent {
  @Input() planeData: PlaneDataState | null = null;
  @Input() environmentalData: EnvironmentalData | null = null;
  @Input() uiState: UIState | null = null;
  @Input() followState: FollowState | null = null;

  @Output() planeSelected = new EventEmitter<PlaneSelectionEvent>();
  @Output() locationChanged = new EventEmitter<LocationChangeEvent>();

  // This component serves as a coordination point for map overlays
  // The actual rendering is handled by the services
}
