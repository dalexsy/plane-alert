import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnInit,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { EngineIconType } from '../../utils/plane-icons';
import { PlaneStyleService } from '../../services/plane-style.service';
import { CelestialService } from '../../services/celestial.service';
import { AltitudeColorService } from '../../services/altitude-color.service';
import { CountryService } from '../../services/country.service';
import { AtmosphericSkyService } from '../../services/atmospheric-sky.service';
import { RainService } from '../../services/rain.service';
import { SkyColorSyncService } from '../../services/sky-color-sync.service';
import { FlagCallsignComponent } from '../flag-callsign/flag-callsign.component';
import { RainOverlayComponent } from '../rain-overlay/rain-overlay.component';

export interface WindowViewPlane {
  x: number; // 0-100, left-right position (azimuth)
  y: number; // 0-100, bottom-up position (altitude)
  callsign: string;
  icao: string; // ICAO code for plane identification
  altitude: number;
  origin: string; // Origin country for flag display
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
  /** True if plane is on ground (landed) */
  isGrounded?: boolean;
  /** Stacking order index for grounded planes */
  groundStackOrder?: number;
  // Moon phase properties for celestialBodyType === 'moon'
  moonPhase?: number;
  moonFraction?: number;
  moonAngle?: number;
  moonIsWaning?: boolean;
  /** True if the celestial body is below the horizon (altitude < 0) */
  belowHorizon?: boolean;
  /** Historical trail positions for window view overlay */
  historyTrail?: Array<{ x: number; y: number; opacity: number }>;
  /** Line segments connecting historical trail dots */
  historySegments?: Array<{
    x: number;
    y: number;
    length: number;
    angle: number;
    opacity: number;
  }>;
}

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FlagCallsignComponent,
    RainOverlayComponent,
  ],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent implements OnChanges, OnInit {
  /** Prevent context menu inside overlay when right-clicking to avoid content.js errors */
  @HostListener('document:contextmenu', ['$event'])
  preventContextMenu(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.elRef.nativeElement.contains(target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  // unified altitude ticks use service default maxAltitude
  /** CSS background gradient reflecting current sky color */
  public skyBackground: string = '';
  public compassBackground: string = '#ff9753';  /** Cloud tile URL for window view background */
  windowCloudUrl: string | null = null;
  /** Cloud filter styles for night-time darkening */
  public cloudFilter: string = 'none';
  /** Cloud backlighting CSS class for atmospheric effects */
  public cloudBacklightClass: string = '';
  /** Individual sky color components for template access */
  public skyBottomColor: string = 'rgb(135, 206, 235)'; // Default sky blue
  public skyTopColor: string = 'rgb(25, 25, 112)'; // Default midnight blue

  /** Convert RGB color string to RGBA with specified opacity */
  public getRgbaColor(rgbColor: string, opacity: number): string {
    const rgbMatch = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
    }
    // Fallback for any unexpected format
    return rgbColor;
  }
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

  /** Maximum altitude represented in window view (for band layout) */
  private readonly viewMaxAltitude = 20000;

  // Altitude ticks, populated in ngOnInit
  public altitudeTicks: Array<{
    y: number;
    label: string;
    color: string;
    fillColor: string;
  }> = [];

  // Marker span boundaries for dimming
  public balconyStartX?: number;
  public balconyEndX?: number;
  public streetsideStartX?: number;
  public streetsideEndX?: number;
  /** Segments to dim outside marker spans */
  public dimSegments: Array<{ left: number; width: number }> = [];
  private readonly maxHistorySegmentLengthPercent = 1; // Max trail segment length in % coordinates
  constructor(
    private celestial: CelestialService,
    public planeStyle: PlaneStyleService,
    private http: HttpClient,
    public altitudeColor: AltitudeColorService,
    private elRef: ElementRef,
    private countryService: CountryService,
    private atmosphericSky: AtmosphericSkyService,
    private rainService: RainService,
    private skyColorSync: SkyColorSyncService
  ) {}
  ngOnInit(): void {
    this.altitudeTicks = this.computeAltitudeTicks();
  }

  /** Emit selection event when user clicks a plane label */
  handleLabelClick(plane: WindowViewPlane, event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(plane);
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
      // compute marker spans for dimming
      this.computeSpans();
      this.setCompassBackground();
      this.assignGroundStackOrder();
      // compute history segments for chemtrail lines
      this.computeHistorySegmentsForPlanes();
    }
  }
  /** Compute altitude ticks for bands */
  private computeAltitudeTicks() {
    const maxAltitudeVisual = this.viewMaxAltitude;
    const tickIncrement = 2000;
    const values: number[] = [];
    for (let alt = 0; alt <= maxAltitudeVisual; alt += tickIncrement) {
      values.push(alt);
    }
    return values.map((tick) => {
      const y = (tick / maxAltitudeVisual) * 100;
      const label = tick === 0 ? '0' : tick / 1000 + 'km';
      const color = this.altitudeColor.getFillColor(tick);
      const fillColor = color.replace('hsl(', 'hsla(').replace(')', ', 0.05)');
      return { y, label, color, fillColor };
    });
  }

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

        // Update rain service with weather and wind data
        this.updateRainSystem(data);

        this.updateSkyBackground();
        this.setCompassBackground();
      },
      () => {
        this.weatherCondition = null;
        this.weatherDescription = null;

        // Stop rain if weather fetch fails
        this.rainService.stopRain();

        this.updateSkyBackground();
        this.setCompassBackground();
      }
    );
  }
  /** Update rain system based on weather API data */
  private updateRainSystem(weatherData: any): void {
    if (!weatherData || !weatherData.weather || !weatherData.weather.length) {
      this.rainService.stopRain();
      return;
    }

    const weather = weatherData.weather[0];
    const condition = weather.main?.toLowerCase() || '';
    const description = weather.description?.toLowerCase() || '';

    // Check if it's currently raining
    const isRaining =
      condition.includes('rain') ||
      condition.includes('drizzle') ||
      condition.includes('thunderstorm');

    if (isRaining) {
      // Extract wind data for realistic rain direction
      const windSpeed = weatherData.wind?.speed || 0; // m/s
      const windDirection = weatherData.wind?.deg || 0; // degrees

      // Extract additional atmospheric data
      const humidity = weatherData.main?.humidity || 50; // percentage
      const pressure = weatherData.main?.pressure || 1013.25; // hPa
      const temperature = weatherData.main?.temp || 288.15; // Kelvin
      const visibility = weatherData.visibility || 10000; // meters

      // Update rain service with comprehensive weather conditions
      this.rainService.updateWeatherConditions(
        condition,
        description,
        windSpeed,
        windDirection,
        humidity,
        pressure,
        temperature,
        visibility
      );
    } else {
      // Stop rain if weather conditions don't indicate precipitation
      this.rainService.stopRain();
    }
  }
  /** Compute and set sky background gradient using atmospheric scattering calculations */
  private updateSkyBackground(): void {
    // Find sun marker for dynamic sky shading
    const sun = this.windowViewPlanes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'sun'
    );

    // Calculate sun elevation angle from the window position
    let sunElevationAngle = 0;
    if (sun && !sun.belowHorizon) {
      // Convert y position (0-100) to elevation angle (-90 to 90 degrees)
      // y=0 is horizon (0°), y=50 is 45°, y=100 is 90° (zenith)
      sunElevationAngle = (sun.y / 100) * 90;
    } else {
      // Sun is below horizon - use negative elevation for twilight/night calculations
      sunElevationAngle = sun ? -10 : -20; // Approximate below-horizon angle
    }

    // Map weather condition to atmospheric sky service format
    let weatherCondition: 'clear' | 'rain' | 'snow' | 'clouds' = 'clear';
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
        weatherCondition = 'rain';
      } else if (cond.includes('snow')) {
        weatherCondition = 'snow';
      } else if (cond.includes('cloud')) {
        // Only treat as cloudy if it's significant cloud cover
        if (!desc.includes('few') && !desc.includes('scattered')) {
          weatherCondition = 'clouds';
        }
      }
    } // Calculate realistic sky colors using atmospheric scattering
    const skyColors = this.atmosphericSky.calculateSkyColors(
      sunElevationAngle,
      weatherCondition
    );    // Create gradient from horizon to zenith
    this.skyBackground = `linear-gradient(to top, ${skyColors.bottomColor} 0%, ${skyColors.topColor} 100%)`;    // Store individual sky color components for template access (e.g., moon gradient)
    this.skyBottomColor = skyColors.bottomColor;
    this.skyTopColor = skyColors.topColor;

    // Update cloud filtering based on sun elevation for night-time darkening
    this.updateCloudFiltering(sunElevationAngle);

    // Publish sky colors to the sync service for use by other components
    this.skyColorSync.updateSkyColors({
      bottomColor: skyColors.bottomColor,
      topColor: skyColors.topColor,
      timestamp: Date.now(),    });
  }  /** Update cloud filtering based on sun elevation for night-time darkening */
  private updateCloudFiltering(sunElevationAngle: number): void {
    // Find moon marker for nighttime backlighting calculations
    const moon = this.windowViewPlanes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'moon'
    );
    
    // Calculate cloud darkening and backlighting based on sun elevation and moon position
    // During day: no filtering (clouds remain white/natural)
    // During twilight: slight darkening with warm backlighting
    // During night: significant darkening with moon-influenced backlighting
    
    if (sunElevationAngle > 15) {
      // Full daylight - no darkening needed, subtle natural backlighting
      this.cloudFilter = 'none';
      this.cloudBacklightClass = 'backlit';
    } else if (sunElevationAngle > 0) {
      // Dawn/dusk - moderate darkening with warm twilight backlighting
      const brightness = 0.4 + (sunElevationAngle / 15) * 0.6; // 0.4 to 1.0
      this.cloudFilter = `brightness(${brightness}) contrast(1.1) hue-rotate(5deg)`;
      this.cloudBacklightClass = 'twilight-backlit';
    } else if (sunElevationAngle > -6) {
      // Civil twilight - noticeable darkening with orange/red backlighting
      const brightness = 0.25 + ((sunElevationAngle + 6) / 6) * 0.15; // 0.25 to 0.4
      this.cloudFilter = `brightness(${brightness}) contrast(1.2) hue-rotate(10deg) saturate(0.8)`;
      this.cloudBacklightClass = 'twilight-backlit';
    } else if (sunElevationAngle > -12) {
      // Nautical twilight - strong darkening with fading backlighting
      const brightness = 0.15 + ((sunElevationAngle + 12) / 6) * 0.1; // 0.15 to 0.25
      this.cloudFilter = `brightness(${brightness}) contrast(1.3) hue-rotate(15deg) saturate(0.6)`;
      this.cloudBacklightClass = 'night-backlit';
    } else {
      // Astronomical twilight or night - maximum darkening with moonlight influence
      let moonInfluence = 0.1; // Base moonlight influence
      
      if (moon && !moon.belowHorizon) {
        // Moon is visible - enhance backlighting based on moon elevation and phase
        const moonElevation = (moon.y / 100) * 90; // Convert to elevation angle
        const moonPhase = moon.moonFraction || 0; // Moon illumination fraction
        
        // Higher moon = more backlighting, fuller moon = more backlighting
        moonInfluence = 0.1 + (moonElevation / 90) * 0.15 + moonPhase * 0.1;
      }
      
      const baseBrightness = 0.1 + moonInfluence * 0.5;
      this.cloudFilter = `brightness(${baseBrightness}) contrast(1.4) hue-rotate(20deg) saturate(0.4)`;
      this.cloudBacklightClass = 'night-backlit';
    }
  }

  /** Compute a perspective transform with dynamic Y rotation based on plane's horizontal position */
  getPerspectiveTransform(plane: WindowViewPlane): string {
    const x = plane.x;
    const ratio = (x - 50) / 50; // -1 to 1
    const maxAngle = 20; // maximum Y rotation in degrees
    const angleY = ratio * maxAngle;
    // rotate icons an additional 90deg in 3D space
    return `perspective(300px) rotateX(60deg) rotateY(${angleY}deg) rotateZ(90deg)`;
  }

  /** Compute marker spans (Balcony and Streetside) to determine dim regions */
  private computeSpans(): void {
    const planes = this.windowViewPlanes.filter((p) => p.isMarker);
    const bStart = planes.find(
      (p) => p.callsign.startsWith('Balcony') && p.callsign.endsWith('Start')
    );
    const bEnd = planes.find(
      (p) => p.callsign.startsWith('Balcony') && p.callsign.endsWith('End')
    );
    const sStart = planes.find(
      (p) => p.callsign.startsWith('Streetside') && p.callsign.endsWith('Start')
    );
    const sEnd = planes.find(
      (p) => p.callsign.startsWith('Streetside') && p.callsign.endsWith('End')
    );

    this.balconyStartX = bStart?.x;
    this.balconyEndX = bEnd?.x;
    this.streetsideStartX = sStart?.x;
    this.streetsideEndX = sEnd?.x;

    // compute dim segments outside Balcony and Streetside spans
    if (
      this.balconyStartX != null &&
      this.balconyEndX != null &&
      this.streetsideStartX != null &&
      this.streetsideEndX != null
    ) {
      const bS = this.balconyStartX;
      const bE = this.balconyEndX;
      const sS = this.streetsideStartX;
      const sE = this.streetsideEndX;
      // segment1: from balconyEnd to streetsideStart
      const seg1Left = bE % 100;
      const seg1Width = (sS - bE + 100) % 100 || 0;
      // segment2: from streetsideEnd to balconyStart
      const seg2Left = sE % 100;
      const seg2Width = (bS - sE + 100) % 100 || 0;
      this.dimSegments = [
        { left: seg1Left, width: seg1Width },
        { left: seg2Left, width: seg2Width },
      ];
    } else {
      this.dimSegments = [];
    }
  }

  /** Return true if x is outside both Balcony and Streetside spans */
  public isOutsideSpan(x: number): boolean {
    const inBalcony =
      this.balconyStartX != null &&
      this.balconyEndX != null &&
      ((this.balconyStartX <= this.balconyEndX &&
        x >= this.balconyStartX &&
        x <= this.balconyEndX) ||
        (this.balconyStartX > this.balconyEndX &&
          (x >= this.balconyStartX || x <= this.balconyEndX)));
    const inStreetside =
      this.streetsideStartX != null &&
      this.streetsideEndX != null &&
      ((this.streetsideStartX <= this.streetsideEndX &&
        x >= this.streetsideStartX &&
        x <= this.streetsideEndX) ||
        (this.streetsideStartX > this.streetsideEndX &&
          (x >= this.streetsideStartX || x <= this.streetsideEndX)));
    return !(inBalcony || inStreetside);
  }
  /** Compute and set dynamic roof color with atmospheric effects and transparency */
  private setCompassBackground(): void {
    // Find sun marker for atmospheric calculations
    const sun = this.windowViewPlanes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'sun'
    );

    // Calculate sun elevation angle from the window position
    let sunElevationAngle = 0;
    if (sun && !sun.belowHorizon) {
      // Convert y position (0-100) to elevation angle (-90 to 90 degrees)
      sunElevationAngle = (sun.y / 100) * 90;
    } else {
      // Sun is below horizon - use negative elevation for twilight/night calculations
      sunElevationAngle = sun ? -10 : -20; // Approximate below-horizon angle
    }

    // Map weather condition to atmospheric sky service format
    let weatherCondition: 'clear' | 'rain' | 'snow' | 'clouds' = 'clear';
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
        weatherCondition = 'rain';
      } else if (cond.includes('snow')) {
        weatherCondition = 'snow';
      } else if (cond.includes('cloud')) {
        // Only treat as cloudy if it's significant cloud cover
        if (!desc.includes('few') && !desc.includes('scattered')) {
          weatherCondition = 'clouds';
        }
      }
    }

    // Get atmospheric sky colors
    const skyColors = this.atmosphericSky.calculateSkyColors(
      sunElevationAngle,
      weatherCondition
    ); // Base roof color (material properties)
    let baseRoofColor = '#ff9753'; // Default terracotta/clay roof

    // Adjust base roof color for lighting conditions
    if (sunElevationAngle <= 0) {
      // At night - much darker roof color
      baseRoofColor = '#3d2416'; // Very dark brown
    } else if (sunElevationAngle < 15) {
      // Dawn/dusk - moderately darker
      const darkFactor = 1 - (sunElevationAngle / 15) * 0.6; // Scale darkness
      const baseRgb = this.parseColor('#ff9753');
      baseRoofColor = `rgb(${Math.round(baseRgb.r * darkFactor)}, ${Math.round(
        baseRgb.g * darkFactor
      )}, ${Math.round(baseRgb.b * darkFactor)})`;
    }

    // Adjust base roof color based on weather conditions for material effects
    if (this.weatherCondition) {
      const cond = this.weatherCondition.toLowerCase();
      if (cond.includes('snow')) {
        // Snow brightens the roof regardless of lighting (reflective)
        if (sunElevationAngle <= 0) {
          baseRoofColor = '#5a4d3b'; // Darker snow-covered roof at night
        } else {
          baseRoofColor = '#d4b896'; // Slightly warmer tone when snow-covered during day
        }
      } else if (
        cond.includes('rain') ||
        cond.includes('drizzle') ||
        cond.includes('thunderstorm')
      ) {
        // Wet surfaces appear darker
        if (sunElevationAngle <= 0) {
          baseRoofColor = '#2a1b0f'; // Very dark when wet at night
        } else {
          baseRoofColor = '#cc7a42'; // Darker when wet during day
        }
      }
    }

    // Parse the atmospheric colors to extract RGB values for blending
    const horizonRgb = this.parseColor(skyColors.bottomColor);
    const zenithRgb = this.parseColor(skyColors.topColor);
    const baseRgb = this.parseColor(baseRoofColor); // Calculate realistic lighting based on available light sources
    let lightIntensity = 1.0; // Full daylight intensity
    let ambientLight = 0.1; // Minimum ambient light (starlight, distant city glow)

    // Calculate light intensity based on sun elevation
    if (sunElevationAngle <= -18) {
      // Astronomical twilight or darker - minimal light
      lightIntensity = ambientLight;
    } else if (sunElevationAngle <= -12) {
      // Nautical twilight
      lightIntensity = ambientLight + ((sunElevationAngle + 18) / 6) * 0.1;
    } else if (sunElevationAngle <= -6) {
      // Civil twilight
      lightIntensity = 0.2 + ((sunElevationAngle + 12) / 6) * 0.3;
    } else if (sunElevationAngle <= 0) {
      // Sunset/sunrise period
      lightIntensity = 0.5 + ((sunElevationAngle + 6) / 6) * 0.4;
    } else if (sunElevationAngle < 15) {
      // Low sun angle - soft lighting
      lightIntensity = 0.9 + (sunElevationAngle / 15) * 0.1;
    } // Reduce light during overcast conditions
    if (weatherCondition === 'rain' || weatherCondition === 'clouds') {
      lightIntensity *= 0.7; // Moderate reduction for overcast (more realistic)
    } else if (weatherCondition === 'snow') {
      lightIntensity *= 0.6; // Snow reflects some light back
    }

    // Apply realistic lighting to base roof color
    // In low light, colors desaturate and darken significantly
    const litBaseRgb = {
      r: Math.round(
        baseRgb.r * lightIntensity + (255 - baseRgb.r) * ambientLight * 0.1
      ),
      g: Math.round(
        baseRgb.g * lightIntensity + (255 - baseRgb.g) * ambientLight * 0.1
      ),
      b: Math.round(
        baseRgb.b * lightIntensity + (255 - baseRgb.b) * ambientLight * 0.1
      ),
    };

    // Calculate atmospheric influence (how much sky color affects the surface)
    let atmosphericInfluence = lightIntensity > 0.5 ? 0.3 : 0.1; // Less atmospheric scattering in low light

    // Further reduce atmospheric influence in very dark conditions
    if (lightIntensity < 0.2) {
      atmosphericInfluence = 0.05;
    }

    const materialRetention = 1 - atmosphericInfluence;

    const blendedRgb = {
      r: Math.round(
        litBaseRgb.r * materialRetention + horizonRgb.r * atmosphericInfluence
      ),
      g: Math.round(
        litBaseRgb.g * materialRetention + horizonRgb.g * atmosphericInfluence
      ),
      b: Math.round(
        litBaseRgb.b * materialRetention + horizonRgb.b * atmosphericInfluence
      ),
    }; // Set the final blended roof color (solid, no transparency)
    this.compassBackground = `rgb(${blendedRgb.r}, ${blendedRgb.g}, ${blendedRgb.b})`;
  }

  /** Parse color string to RGB values */
  private parseColor(colorStr: string): { r: number; g: number; b: number } {
    // Handle rgb() format
    const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }

    // Handle hex format
    const hexMatch = colorStr.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16),
      };
    }

    // Fallback to default roof color
    return { r: 255, g: 151, b: 83 }; // #ff9753
  }

  /** Assign incremental stack index to grounded planes */
  private assignGroundStackOrder(): void {
    let order = 0;
    this.windowViewPlanes.forEach((p) => {
      if (p.isGrounded) {
        p.groundStackOrder = order++;
      } else {
        p.groundStackOrder = undefined;
      }
    });
  }

  /** Compute rotation angle from historical trail movement */
  private getMovementAngle(plane: WindowViewPlane): number | null {
    const trail = plane.historyTrail;
    if (trail && trail.length >= 2) {
      const prev = trail[trail.length - 2];
      const last = trail[trail.length - 1];
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const angleRad = Math.atan2(dy, dx);
      return angleRad * (180 / Math.PI);
    }
    return null;
  }

  /** Return CSS rotateZ transform, preferring movement-based orientation */
  public getIconRotation(plane: WindowViewPlane): string {
    const movement = this.getMovementAngle(plane);
    if (movement !== null) {
      return `rotateZ(${movement}deg)`;
    }
    const bearing = plane.bearing ?? 0;
    const offset = plane.x > 50 ? -90 : -45;
    return `rotateZ(${bearing + offset}deg)`;
  }

  /** Calculate segments connecting historyTrail points */
  private computeHistorySegmentsForPlanes(): void {
    this.windowViewPlanes.forEach((plane) => {
      if (plane.historyTrail && plane.historyTrail.length >= 2) {
        plane.historySegments = this.computeSegments(plane.historyTrail);
      } else {
        plane.historySegments = [];
      }
    });
  }

  /** Compute line segments from trail points */
  private computeSegments(
    trail: Array<{ x: number; y: number; opacity: number }>
  ): Array<{
    x: number;
    y: number;
    length: number;
    angle: number;
    opacity: number;
  }> {
    const segments: Array<{
      x: number;
      y: number;
      length: number;
      angle: number;
      opacity: number;
    }> = [];
    for (let i = 0; i < trail.length - 1; i++) {
      const p1 = trail[i];
      const p2 = trail[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      // Skip segments with endpoints outside the visible map bounds
      if (
        p1.x < 0 ||
        p1.x > 100 ||
        p2.x < 0 ||
        p2.x > 100 ||
        p1.y < 0 ||
        p1.y > 100 ||
        p2.y < 0 ||
        p2.y > 100
      ) {
        continue;
      }
      // Skip segments that are too long (likely discontinuous)
      if (length > this.maxHistorySegmentLengthPercent) {
        continue;
      }
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const opacity = (p1.opacity + p2.opacity) / 2;
      segments.push({ x: p1.x, y: p1.y, length, angle, opacity });
    }
    return segments;
  }
}
