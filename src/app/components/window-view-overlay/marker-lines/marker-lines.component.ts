import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowViewPlane } from '../window-view-overlay.component';

@Component({
  selector: 'app-marker-lines',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marker-lines.component.html',
  styleUrls: ['./marker-lines.component.scss'],
})
export class MarkerLinesComponent {
  @Input() markerPlanes: WindowViewPlane[] = [];

  /** TrackBy function to prevent unnecessary DOM re-creation during animations */
  trackByPlaneIcao(index: number, plane: WindowViewPlane): string {
    return plane.icao || plane.callsign || `${index}`;
  }
}
