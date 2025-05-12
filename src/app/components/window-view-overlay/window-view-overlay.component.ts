import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EngineIconType } from '../../../app/utils/plane-icons';

export interface WindowViewPlane {
  x: number; // 0-100, left-right position (azimuth)
  y: number; // 0-100, bottom-up position (altitude)
  callsign: string;
  altitude: number;
  bearing?: number;
  isMarker?: boolean;
  azimuth?: number;
  compass?: string;
  iconPath?: string;
  iconType?: EngineIconType;
  isHelicopter?: boolean;
  velocity?: number;
  trailLength?: number;
  trailOpacity?: number;
}

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent {
  @Input() windowViewPlanes: WindowViewPlane[] = [];
}
