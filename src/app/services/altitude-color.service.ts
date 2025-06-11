import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AltitudeColorService {
  private readonly maxAltitude = 12000; // meters (universal max altitude)

  /**
   * Get color for a given altitude, normalized against maxAltitude or an optional override.
   * @param altitude altitude in meters
   */
  getFillColor(altitude: number): string {
    const ratio = Math.max(0, Math.min(altitude / this.maxAltitude, 1));
    const hue = Math.sqrt(ratio) * 300;
    return `hsl(${Math.floor(hue)}, 100%, 50%)`;
  }

  /**
   * Get the maximum altitude used for color normalization.
   */
  public getMaxAltitude(): number {
    return this.maxAltitude;
  }
}
