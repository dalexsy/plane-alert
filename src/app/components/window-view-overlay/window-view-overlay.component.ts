import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
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
  trailPivotLeft?: string; // For dynamic style.left
  trailPivotTop?: string; // For dynamic style.top
  trailRotation?: number; // For dynamic style.transform rotateZ
  trailPivotOffsetX?: number; // For dynamic style.left, offset from center in px
  trailPivotOffsetY?: number; // For dynamic style.top, offset from center in px
  isCelestial?: boolean; // Added for Sun/Moon
  celestialBodyType?: 'sun' | 'moon'; // Added for Sun/Moon
  scale?: number; // Scale relative to viewer distance
  distanceKm?: number; // Distance from viewer in km for dimming
}

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent implements OnChanges {
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
      // eslint-disable-next-line no-console
      console.log(
        `[WINDOW VIEW] Plane ${plane.callsign} at ${
          plane.altitude
        }m (y=${plane.y.toFixed(2)}%) in band ${bandLabel} (${bandColor})`
      );
    }
  }
}
