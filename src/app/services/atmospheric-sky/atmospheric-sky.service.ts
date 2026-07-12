import { Injectable } from '@angular/core';
import {
  applyWeatherEffects,
  calculateAtmosphericScattering,
  calculateTurbidityFromWeather,
  getCivilTwilightColors,
  getDeepTwilightColors,
  getNightSkyColors,
  getSunriseSunsetColors,
} from './atmospheric-sky-colors.util';

@Injectable({ providedIn: 'root' })
export class AtmosphericSkyService {
  calculateSkyColors(
    sunElevationDegrees: number,
    weatherCondition?: string,
    weatherDescription?: string,
    turbidity: number = 2.0
  ): { bottomColor: string; topColor: string } {
    const sunElevation = sunElevationDegrees;
    if (sunElevation <= -18) return getNightSkyColors();
    if (sunElevation <= -12) return getDeepTwilightColors(sunElevation);
    if (sunElevation <= -6) return getCivilTwilightColors(sunElevation);
    if (sunElevation <= 0) return getSunriseSunsetColors(sunElevation);

    const theta = (sunElevation * Math.PI) / 180;
    const baseColors = calculateAtmosphericScattering(theta, turbidity);
    return applyWeatherEffects(baseColors, weatherCondition, weatherDescription, sunElevation);
  }

  calculateTurbidity(weatherCondition?: string, visibility?: number): number {
    return calculateTurbidityFromWeather(weatherCondition, visibility);
  }
}
