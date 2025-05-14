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
import SunCalc from 'suncalc';

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
  // Moon phase properties for celestialBodyType === 'moon'
  moonPhase?: number;
  moonFraction?: number;
  moonAngle?: number;
  moonIsWaning?: boolean;
  /** True if the celestial body is below the horizon (altitude < 0) */
  belowHorizon?: boolean;
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

  @Input() observerLat!: number;
  @Input() observerLon!: number;

  // Precompute altitude ticks once to avoid recalculation and flicker
  readonly altitudeTicks = (() => {
    const maxAltitudeVisual = 20000; // New maximum altitude for the view
    const tickIncrement = 2000; // Increment for altitude ticks
    const ticksAltitudeValues: number[] = [];
    for (let alt = 0; alt <= maxAltitudeVisual; alt += tickIncrement) {
      ticksAltitudeValues.push(alt);
    }
    return ticksAltitudeValues.map((tick, i) => ({
      y: (tick / maxAltitudeVisual) * 100, // Scale y position to the new maxAltitudeVisual
      label: tick === 0 ? '0' : tick / 1000 + 'km',
      color: this.getAltitudeColor(
        {
          y: (tick / maxAltitudeVisual) * 100,
          label: tick === 0 ? '0' : tick / 1000 + 'km',
        },
        i
      ),
    }));
  })();

  injectCelestialMarkers() {
    if (
      typeof this.observerLat !== 'number' ||
      typeof this.observerLon !== 'number'
    )
      return;
    const now = new Date();
    const sunPos = SunCalc.getPosition(now, this.observerLat, this.observerLon);
    const moonPos = SunCalc.getMoonPosition(
      now,
      this.observerLat,
      this.observerLon
    );
    const moonIllum = SunCalc.getMoonIllumination(now);
    // Map SunCalc azimuth (0=south, 90=west, 180=north, 270=east, 360=south) to x=0-100 (0=south, 25=west, 50=north, 75=east, 100=south)
    const azToX = (az: number) => {
      let azDeg = (az * 180) / Math.PI;
      azDeg = (azDeg + 360) % 360; // Normalize to 0-360
      return (azDeg / 360) * 100;
    };
    // Altitude: 0 (horizon) = 0%, π/2 (zenith) = 100%
    const altToY = (alt: number) =>
      Math.max(0, Math.min(100, (alt / (Math.PI / 2)) * 100));
    const sunBelowHorizon = sunPos.altitude < 0;
    const moonBelowHorizon = moonPos.altitude < 0;
    const sunMarker: WindowViewPlane = {
      x: azToX(sunPos.azimuth),
      y: altToY(sunPos.altitude),
      callsign: 'Sun',
      icao: 'SUN',
      altitude: 0,
      isCelestial: true,
      celestialBodyType: 'sun',
      scale: 1.0,
      isMarker: false,
      belowHorizon: sunPos.altitude < 0,
    };
    // Add moon phase data for rendering
    // The SunCalc phase is 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter, 1=new
    // The fraction is illuminated fraction (0=new, 1=full)
    // For the SVG mask, the illuminated side should always face the sun
    // Compute the correct orientation: angle from moon to sun in azimuth
    const moonToSunAz = sunPos.azimuth - moonPos.azimuth;
    // The mask should be flipped if waning (phase > 0.5)
    const isWaning = moonIllum.phase > 0.5;
    const moonAngle = (moonToSunAz * 180) / Math.PI; // degrees, positive = rotate CCW
    const moonMarker: WindowViewPlane = {
      x: azToX(moonPos.azimuth),
      y: altToY(moonPos.altitude),
      callsign: 'Moon',
      icao: 'MOON',
      altitude: 0,
      isCelestial: true,
      celestialBodyType: 'moon',
      scale: 1.0,
      isMarker: false,
      // Add moon phase info for template
      moonPhase: moonIllum.phase, // 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
      moonFraction: moonIllum.fraction, // 0=new, 1=full
      moonAngle: moonAngle, // degrees, for SVG rotation
      moonIsWaning: isWaning,
      belowHorizon: moonPos.altitude < 0,
    };
    // Remove any existing celestial markers
    this.windowViewPlanes = this.windowViewPlanes.filter((p) => !p.isCelestial);
    // Add sun and moon
    this.windowViewPlanes = [...this.windowViewPlanes, sunMarker, moonMarker];

    // Log the actual sun and moon altitude in degrees and their belowHorizon status
    const sunAltDeg = (sunPos.altitude * 180) / Math.PI;
    const moonAltDeg = (moonPos.altitude * 180) / Math.PI;
    console.log(
      `[WindowViewOverlay] Sun: ${
        sunBelowHorizon ? 'below' : 'above'
      } horizon (alt: ${sunAltDeg.toFixed(2)}°), Moon: ${
        moonBelowHorizon ? 'below' : 'above'
      } horizon (alt: ${moonAltDeg.toFixed(2)}°)`
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['windowViewPlanes'] ||
      changes['observerLat'] ||
      changes['observerLon']
    ) {
      this.injectCelestialMarkers();
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
