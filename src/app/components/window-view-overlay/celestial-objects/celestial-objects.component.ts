import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowViewPlane } from '../window-view-overlay.component';

@Component({
  selector: 'app-celestial-objects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './celestial-objects.component.html',
  styleUrl: './celestial-objects.component.scss'
})
export class CelestialObjectsComponent {
  @Input() celestialObjects: WindowViewPlane[] = [];
  @Input() isDaytime: boolean = false;

  /** TrackBy function to prevent unnecessary DOM re-creation during animations */
  trackByPlaneIcao(index: number, plane: WindowViewPlane): string {
    return plane.icao || plane.callsign || `${index}`;
  }
}
