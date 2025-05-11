import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../ui/icon.component';

export interface WindowViewPlane {
  x: number; // 0-100, left-right position (azimuth)
  y: number; // 0-100, bottom-up position (altitude)
  callsign: string;
  altitude: number;
}

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent {
  @Input() windowViewPlanes: WindowViewPlane[] = [];
}
