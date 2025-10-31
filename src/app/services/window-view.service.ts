import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';

@Injectable({
  providedIn: 'root',
})
export class WindowViewService {
  // Window view planes for overlay
  public windowViewPlanes: WindowViewPlane[] = [];

  constructor(private settings: SettingsService) {}

  /** Toggle window view overlay visibility */
  public toggleWindowView(show: boolean): void {
    this.settings.setShowWindowView(show);
  }

  /** Update window view markers for cone boundaries and midpoints */
  public updateWindowViewMarkers(): void {
    // Define the azimuth ranges directly matching ConeComponent angles
    const cones = [
      { label: 'Balcony', start: 75, end: 190 }, // ENE to S
      { label: 'Streetside', start: 245, end: 345 }, // SW to N
    ];

    // Use a fixed radius for window view markers (e.g., 10km)
    const markerRadiusKm = 10;

    // Get home location as the anchor
    const home = this.getHomeLocationValue();
    if (!home) return;

    const lat = home.lat;
    const lon = home.lon;

    // Helper to convert azimuth (deg, 0=N) to window view x (0-100, 0=left, 100=right)
    const azToX = (az: number) => (((az + 180) % 360) / 360) * 100;

    // Helper to convert azimuth to compass direction
    const azToCompass = (az: number) => {
      const dirs = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
      ];
      return dirs[Math.round((az % 360) / 22.5) % 16];
    };

    // Helper to convert radius to y (altitude) for window view (fixed at 10km)
    const y = (10 / 12) * 70; // 10km out of 12km max altitude (scaled down to avoid clipping)

    // Build marker objects
    const markers = cones.flatMap(({ label, start, end }) => {
      const mid = (start + end) / 2;
      return [
        {
          x: azToX(start),
          y,
          callsign: `${label} Start`,
          altitude: -1, // negative altitude to indicate not a real plane
          isMarker: true,
          azimuth: start,
          compass: azToCompass(start),
          icao: `marker-${label}-start`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(mid),
          y,
          callsign: label,
          altitude: -1,
          isMarker: true,
          azimuth: mid,
          compass: azToCompass(mid),
          icao: `marker-${label}-mid`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
        {
          x: azToX(end),
          y,
          callsign: `${label} End`,
          altitude: -1,
          isMarker: true,
          azimuth: end,
          compass: azToCompass(end),
          icao: `marker-${label}-end`, // Assign dummy icao for type safety
          origin: '', // Empty origin for marker objects
        },
      ];
    });

    // Merge with actual planes for overlay, preserving all real planes (including grounded) and adding markers
    this.windowViewPlanes = [
      // keep only real plane entries (exclude marker objects)
      ...this.windowViewPlanes.filter((p) => !p.isMarker),
      // then append marker entries
      ...markers,
    ];
  }

  /** Get stored home location */
  private getHomeLocationValue(): { lat: number; lon: number } | null {
    return this.settings.getHomeLocation() || null;
  }

  /** Clear window view planes */
  public clearWindowViewPlanes(): void {
    this.windowViewPlanes = [];
  }
}
