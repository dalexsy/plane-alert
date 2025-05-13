import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EngineIconType } from '../../../app/utils/plane-icons';
import { PlaneStyleService } from '../../../app/services/plane-style.service';

export interface WindowViewPlane {
  x: number; // 0-100, left-right position (azimuth)
  y: number; // 0-100, bottom-up position (altitude)
  callsign: string;
  icao: string; // ICAO code for plane identification
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
  trailPivotLeft?: string; // For dynamic style.left
  trailPivotTop?: string; // For dynamic style.top
  trailRotation?: number; // For dynamic style.transform rotateZ
  trailPivotOffsetX?: number; // For dynamic style.left, offset from center in px
  trailPivotOffsetY?: number; // For dynamic style.top, offset from center in px
  isCelestial?: boolean; // Added for Sun/Moon
  celestialBodyType?: 'sun' | 'moon'; // Added for Sun/Moon
  scale?: number; // Scale relative to viewer distance
  distanceKm?: number; // Distance from viewer in km for dimming
  isNew?: boolean; // Flag for new planes
  isMilitary?: boolean;
  isSpecial?: boolean;
}

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent implements OnChanges {
  /** Currently highlighted/followed plane ICAO */
  @Input() highlightedPlaneIcao: string | null = null;
  /** Emit selection when a plane label is clicked */
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();
  constructor(public planeStyle: PlaneStyleService) {} // Inject styling service
  /** Emit selection event when user clicks a plane label */
  handleLabelClick(plane: WindowViewPlane, event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(plane);
  }
  @Input() windowViewPlanes: WindowViewPlane[] = [];

  // Precompute altitude ticks once to avoid recalculation and flicker
  readonly altitudeTicks = (() => {
    const maxAltitudeVisual = 20000; // New maximum altitude for the view
    const tickIncrement = 2000; // Increment for altitude ticks
    const ticksAltitudeValues: number[] = [];
    for (let alt = 0; alt <= maxAltitudeVisual; alt += tickIncrement) {
      ticksAltitudeValues.push(alt);
    }

    return ticksAltitudeValues.map((tick) => ({
      y: (tick / maxAltitudeVisual) * 100, // Scale y position to the new maxAltitudeVisual
      label: tick === 0 ? '0' : tick / 1000 + 'km',
    }));
  })();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['windowViewPlanes']) {
      this.logPlaneBands();
    }
  }

  /** Compute a perspective transform with dynamic Y rotation based on plane's horizontal position */
  getPerspectiveTransform(plane: WindowViewPlane): string {
    const x = plane.x;
    const ratio = (x - 50) / 50; // -1 to 1
    const maxAngle = 20; // maximum Y rotation in degrees
    const angleY = ratio * maxAngle;
    return `perspective(300px) rotateX(60deg) rotateY(${angleY}deg)`;
  }

  // Updated to use a predefined sequence of ratios to match ConeComponent's color progression
  getAltitudeColor(tick: { y: number; label: string }, i: number): string {
    const coneRatios = [0.01, 0.04, 0.16, 0.36, 0.64, 1.0]; // Ratios for Orange, Yellow, Green, Cyan, Blue, Magenta
    const maxIndex = coneRatios.length - 1; // 5
    let bandIndex: number;
    if (i < maxIndex) {
      // intervals 0-4 (0-10km) map directly
      bandIndex = i;
    } else if (i === maxIndex) {
      // interval 5 (10-12km) should still be Blue (index 4)
      bandIndex = maxIndex - 1;
    } else {
      // intervals >=6 (12km+) map to Magenta (index 5)
      bandIndex = maxIndex;
    }
    const ratio = coneRatios[bandIndex];

    const hue = Math.sqrt(ratio) * 300;
    return `hsl(${Math.floor(hue)}, 100%, 50%)`;
  }

  logPlaneBands() {
    const bands = this.altitudeTicks;
    for (const plane of this.windowViewPlanes) {
      if (plane.isMarker) continue;
      let bandIdx = -1;
      for (let i = 0; i < bands.length - 1; i++) {
        if (plane.y >= bands[i].y && plane.y < bands[i + 1].y) {
          bandIdx = i;
          break;
        }
      }
      if (bandIdx === -1 && plane.y >= bands[bands.length - 1].y) {
        bandIdx = bands.length - 2;
      }
      const bandLabel = bandIdx >= 0 ? bands[bandIdx].label : 'below';
      const bandColor =
        bandIdx >= 0 ? this.getAltitudeColor(bands[bandIdx], bandIdx) : 'none';
    }
  }
}
