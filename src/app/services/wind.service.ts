import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class WindService {
  private readonly OPEN_WEATHER_MAP_API_KEY =
    'ffcc03a274b2d049bf4633584e7b5699';

  constructor(private settings: SettingsService) {}

  /**
   * Fetch wind direction from OpenWeatherMap and update wind properties
   */
  async fetchWindDirection(
    lat: number,
    lon: number
  ): Promise<{
    speed: number;
    direction: number;
    stat: number;
  } | null> {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.OPEN_WEATHER_MAP_API_KEY}`
      );

      if (response.status === 429) {
        // Too Many Requests: skip update
        return null;
      }

      const data = await response.json();
      if (!data) return null;

      const speed = data.wind?.speed ?? 0;
      const windFrom = data.wind?.deg ?? 0;

      // Compute stat 0-3 based on speed
      let stat = 0;
      if (speed >= 6) stat = 3;
      else if (speed >= 3) stat = 2;
      else if (speed >= 0.5) stat = 1;

      return {
        speed,
        direction: windFrom,
        stat,
      };
    } catch (error) {
      console.error('Failed to fetch wind direction:', error);
      return null;
    }
  }

  /**
   * Convert wind direction in degrees to compass point (e.g. N, NE, E, etc.)
   */
  getWindFromDirection(deg: number): string {
    const directions = [
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
    const index = Math.round((deg % 360) / 22.5);
    return directions[index % directions.length];
  }

  /**
   * Convert wind speed from m/s to the specified unit
   */
  convertWindSpeed(speedMs: number, unit: string): number {
    switch (unit) {
      case 'knots':
        return speedMs * 1.94384; // m/s to knots
      case 'km/h':
        return speedMs * 3.6; // m/s to km/h
      case 'mph':
        return speedMs * 2.23694; // m/s to mph
      case 'm/s':
      default:
        return speedMs;
    }
  }

  /**
   * Get the current wind speed in the selected unit
   */
  getCurrentWindSpeed(speedMs: number): number {
    const unit = this.getCurrentWindUnit();
    return this.convertWindSpeed(speedMs, unit);
  }

  /**
   * Get the current wind unit string
   */
  getCurrentWindUnit(): string {
    const units = ['m/s', 'knots', 'km/h', 'mph'];
    return units[this.settings.windUnitIndex];
  }

  /**
   * Cycle to the next wind unit
   */
  cycleWindUnit(): string {
    const units = ['m/s', 'knots', 'km/h', 'mph'];
    const nextIndex = (this.settings.windUnitIndex + 1) % units.length;
    this.settings.setWindUnitIndex(nextIndex);
    return units[nextIndex];
  }
}
