import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';
import { PlaneLogEntry } from '../results-overlay/results-overlay.component';

@Component({
  selector: 'app-location-button',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <app-button
      [icon]="
        hoverState || plane.icao === highlightedPlaneIcao
          ? 'my_location'
          : 'location_searching'
      "
      type="tertiary"
      size="small"
      (click)="centerPlane.emit(plane)"
      (mouseenter)="hoverState = true"
      (mouseleave)="hoverState = false"
      [disabled]="!plane.lat || !plane.lon || !activePlaneIcaos.has(plane.icao)"
      [title]="
        !plane.lat || !plane.lon || !activePlaneIcaos.has(plane.icao)
          ? 'No longer in range.'
          : 'Center plane on map'
      "
      ariaLabel="Center plane on map"
    ></app-button>
  `,
})
export class LocationButtonComponent {
  @Input() plane!: PlaneLogEntry;
  @Input() highlightedPlaneIcao!: string | null;
  @Input() activePlaneIcaos!: Set<string>;
  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();

  hoverState = false;
}
