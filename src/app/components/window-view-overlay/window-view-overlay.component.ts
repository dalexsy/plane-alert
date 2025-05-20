import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { EngineIconType } from '../../../app/utils/plane-icons';
import { PlaneStyleService } from '../../../app/services/plane-style.service';
import { CelestialService } from '../../../app/services/celestial.service';

export interface WindowViewPlane {
  x: number; // 0-100, left-right position (azimuth)
  y: number; // 0-100, bottom-up position (altitude)
  callsign: string;
  icao: string; // ICAO code for plane identification
  altitude: number;
  lat?: number; // Optional geographic coordinates for centering
  lon?: number;
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
  imports: [CommonModule, HttpClientModule],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent implements OnChanges {
  /** CSS background gradient reflecting current sky color */
  public skyBackground: string = '';
  /** Cloud tile URL for window view background */
  windowCloudUrl: string | null = null;
  /** Current weather condition from API */
  public weatherCondition: string | null = null;
  /** Detailed weather description from API */
  private weatherDescription: string | null = null;
  /** Currently highlighted/followed plane ICAO */
  @Input() highlightedPlaneIcao: string | null = null;
  /** Planes to display in window view */
  @Input() windowViewPlanes: WindowViewPlane[] = [];

  @Input() observerLat!: number;
  @Input() observerLon!: number;

  @Output() selectPlane = new EventEmitter<WindowViewPlane>();

  /** Cloud tile URL for window view background */
  private readonly OWM_TILE_ZOOM = 3;
  private readonly OPEN_WEATHER_MAP_API_KEY =
    'ffcc03a274b2d049bf4633584e7b5699';

  constructor(
    private celestial: CelestialService,
    public planeStyle: PlaneStyleService,
    private http: HttpClient
  ) {}

  /** Emit selection event when user clicks a plane label */
  handleLabelClick(plane: WindowViewPlane, event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(plane);
  }

  // Precompute altitude ticks once to avoid recalculation and flicker
  readonly altitudeTicks = (() => {
    const maxAltitudeVisual = 20000; // New maximum altitude for the view
    const tickIncrement = 2000; // Increment for altitude ticks
    const ticksAltitudeValues: number[] = [];
    for (let alt = 0; alt <= maxAltitudeVisual; alt += tickIncrement) {
      ticksAltitudeValues.push(alt);
    }
    return ticksAltitudeValues.map((tick, i) => {
      const y = (tick / maxAltitudeVisual) * 100;
      const label = tick === 0 ? '0' : tick / 1000 + 'km';
      const color = this.getAltitudeColor({ y, label }, i);
      // derive a 10% opacity fill color from the HSL color
      const fillColor = color.replace('hsl(', 'hsla(').replace(')', ', 0.05)');
      return { y, label, color, fillColor };
    });
  })();

  injectCelestialMarkers() {
    if (
      !Number.isFinite(this.observerLat) ||
      !Number.isFinite(this.observerLon)
    ) {
      return;
    }
    const markers = this.celestial.getMarkers(
      this.observerLat,
      this.observerLon
    );
    // Remove old celestial and append new
    this.windowViewPlanes = [
      ...this.windowViewPlanes.filter((p) => !p.isCelestial),
      ...markers,
    ];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['windowViewPlanes'] ||
      changes['observerLat'] ||
      changes['observerLon']
    ) {
      this.injectCelestialMarkers();
      this.updateWindowCloud();
      // initial sky update then fetch weather
      this.updateSkyBackground();
      this.updateWeather();
    }
  }

  /** Calculate and set cloud cover tile for window overlay */
  private updateWindowCloud(): void {
    if (
      !Number.isFinite(this.observerLat) ||
      !Number.isFinite(this.observerLon)
    ) {
      this.windowCloudUrl = null;
      return;
    }
    const z = 3;
    const n = 1 << z;
    const latRad = (this.observerLat * Math.PI) / 180;
    const x = Math.floor(((this.observerLon + 180) / 360) * n);
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
        n
    );
    this.windowCloudUrl = `https://tile.openweathermap.org/map/clouds_new/${z}/${x}/${y}.png?appid=ffcc03a274b2d049bf4633584e7b5699`;
  }

  /** Fetch current weather and re-render sky */
  private updateWeather(): void {
    if (
      !Number.isFinite(this.observerLat) ||
      !Number.isFinite(this.observerLon)
    ) {
      return;
    }
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${this.observerLat}&lon=${this.observerLon}&appid=${this.OPEN_WEATHER_MAP_API_KEY}`;
    this.http.get<any>(url).subscribe(
      (data) => {
        if (data.weather && data.weather.length) {
          this.weatherCondition = data.weather[0].main;
          this.weatherDescription = data.weather[0].description;
        } else {
          this.weatherCondition = null;
          this.weatherDescription = null;
        }
        this.updateSkyBackground();
      },
      () => {
        this.weatherCondition = null;
        this.weatherDescription = null;
        this.updateSkyBackground();
      }
    );
  }

  /** Compute and set sky background gradient based on sun altitude */
  private updateSkyBackground(): void {
    // find sun marker for dynamic sky shading
    const sun = this.windowViewPlanes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'sun'
    );
    // dark night fallback
    if (!sun || sun.belowHorizon) {
      this.skyBackground = 'linear-gradient(to top, #001122 0%, #001122 100%)';
      return;
    }
    // heavy overcast clouds: main 'Clouds' and not just few/scattered
    const mainCond = this.weatherCondition
      ? this.weatherCondition.toLowerCase()
      : '';
    const desc = this.weatherDescription
      ? this.weatherDescription.toLowerCase()
      : '';
    if (
      mainCond === 'clouds' &&
      !desc.includes('few') &&
      !desc.includes('scattered')
    ) {
      // deep overcast: dull grey sky
      this.skyBackground = 'linear-gradient(to top, #666666 0%, #999999 100%)';
      return;
    }
    // t: 0 at horizon, 1 at zenith
    const t = sun.y / 100;
    const hue = 210; // standard sky hue
    // base lightness values
    let bottomL = 55 + t * 30; // 40% to 70%
    let topL = 80 + t * 20; // 60% to 80%
    // base saturation for clear sky
    let sat = 80;
    // adjust based on weather
    if (this.weatherCondition) {
      const cond = this.weatherCondition.toLowerCase();
      const desc = this.weatherDescription
        ? this.weatherDescription.toLowerCase()
        : '';
      if (
        cond.includes('rain') ||
        cond.includes('drizzle') ||
        cond.includes('thunderstorm')
      ) {
        // rainy: dark grey sky
        bottomL = 20;
        topL = 40;
        sat = 10;
      } else if (cond.includes('snow')) {
        bottomL = 75;
        topL = 90;
        sat = 40;
      } else if (cond.includes('cloud')) {
        // overcast or cloudy: dull, low-saturation sky
        bottomL = 30;
        topL = 50;
        sat = 20;
        // if just scattered clouds, keep a bit brighter
        if (desc.includes('scattered') || desc.includes('few')) {
          bottomL += 10;
          topL += 10;
          sat = 40;
        }
      }
    }
    const bottomColor = `hsl(${hue}, ${sat}%, ${bottomL.toFixed(0)}%)`;
    const topColor = `hsl(${hue}, ${sat}%, ${topL.toFixed(0)}%)`;
    this.skyBackground = `linear-gradient(to top, ${bottomColor} 0%, ${topColor} 100%)`;
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
      if (plane.altitude !== undefined) {
        const altKm = Math.round(plane.altitude / 1000);
        if (altKm >= 0 && altKm < bands.length) {
          const band = bands[altKm];
          console.log(
            `Plane ${plane.callsign} (${plane.icao}) at ${
              plane.altitude
            }m in band ${altKm}: ${JSON.stringify(band)}`
          );
        }
      }
    }
  }
}
