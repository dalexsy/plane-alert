import { Injectable } from '@angular/core';
import { AtmosphericSkyService } from '../atmospheric-sky.service';
import type { WindowViewPlane } from '../../types/window-view-plane';

function parseColor(colorStr: string): { r: number; g: number; b: number } {
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  const hexMatch = colorStr.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }
  return { r: 255, g: 151, b: 83 };
}

@Injectable({ providedIn: 'root' })
export class WindowViewCompassColorsService {
  compassBackground = '#ff9753';
  chimneyBackground = '';

  constructor(private atmosphericSky: AtmosphericSkyService) {}

  refresh(planes: WindowViewPlane[], weatherCondition: string | null, weatherDescription: string | null): void {
    const sun = planes.find(
      (p) => p.isCelestial && p.celestialBodyType === 'sun'
    );
    let sunElevationAngle = 0;
    if (sun && !sun.belowHorizon) {
      sunElevationAngle = (sun.y / 100) * 90;
    } else {
      sunElevationAngle = sun ? -10 : -20;
    }

    let skyWeather: 'clear' | 'rain' | 'snow' | 'clouds' = 'clear';
    if (weatherCondition) {
      const cond = weatherCondition.toLowerCase();
      const desc = weatherDescription?.toLowerCase() || '';
      if (
        cond.includes('rain') ||
        cond.includes('drizzle') ||
        cond.includes('thunderstorm')
      ) {
        skyWeather = 'rain';
      } else if (cond.includes('snow')) {
        skyWeather = 'snow';
      } else if (
        cond.includes('cloud') &&
        !desc.includes('few') &&
        !desc.includes('scattered')
      ) {
        skyWeather = 'clouds';
      }
    }

    const skyColors = this.atmosphericSky.calculateSkyColors(
      sunElevationAngle,
      skyWeather
    );
    let baseRoofColor = '#ff9753';
    if (sunElevationAngle <= 0) {
      baseRoofColor = '#3d2416';
    } else if (sunElevationAngle < 15) {
      const darkFactor = 1 - (sunElevationAngle / 15) * 0.6;
      const baseRgb = parseColor('#ff9753');
      baseRoofColor = `rgb(${Math.round(baseRgb.r * darkFactor)}, ${Math.round(
        baseRgb.g * darkFactor
      )}, ${Math.round(baseRgb.b * darkFactor)})`;
    }

    if (weatherCondition) {
      const cond = weatherCondition.toLowerCase();
      if (cond.includes('snow')) {
        baseRoofColor =
          sunElevationAngle <= 0 ? '#5a4d3b' : '#d4b896';
      } else if (
        cond.includes('rain') ||
        cond.includes('drizzle') ||
        cond.includes('thunderstorm')
      ) {
        baseRoofColor =
          sunElevationAngle <= 0 ? '#2a1b0f' : '#cc7a42';
      }
    }

    const horizonRgb = parseColor(skyColors.bottomColor);
    const baseRgb = parseColor(baseRoofColor);
    let lightIntensity = 1.0;
    const ambientLight = 0.1;
    if (sunElevationAngle <= -18) {
      lightIntensity = ambientLight;
    } else if (sunElevationAngle <= -12) {
      lightIntensity = ambientLight + ((sunElevationAngle + 18) / 6) * 0.1;
    } else if (sunElevationAngle <= -6) {
      lightIntensity = 0.2 + ((sunElevationAngle + 12) / 6) * 0.3;
    } else if (sunElevationAngle <= 0) {
      lightIntensity = 0.5 + ((sunElevationAngle + 6) / 6) * 0.4;
    } else if (sunElevationAngle < 15) {
      lightIntensity = 0.9 + (sunElevationAngle / 15) * 0.1;
    }
    if (skyWeather === 'rain' || skyWeather === 'clouds') {
      lightIntensity *= 0.7;
    } else if (skyWeather === 'snow') {
      lightIntensity *= 0.6;
    }

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
    let atmosphericInfluence = lightIntensity > 0.5 ? 0.3 : 0.1;
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
    };
    this.compassBackground = `rgb(${blendedRgb.r}, ${blendedRgb.g}, ${blendedRgb.b})`;

    const chimneyBaseRgb = parseColor('#cabab0');
    const litChimneyRgb = {
      r: Math.round(
        chimneyBaseRgb.r * lightIntensity +
          (255 - chimneyBaseRgb.r) * ambientLight * 0.1
      ),
      g: Math.round(
        chimneyBaseRgb.g * lightIntensity +
          (255 - chimneyBaseRgb.g) * ambientLight * 0.1
      ),
      b: Math.round(
        chimneyBaseRgb.b * lightIntensity +
          (255 - chimneyBaseRgb.b) * ambientLight * 0.1
      ),
    };
    const blendedChimneyRgb = {
      r: Math.round(
        litChimneyRgb.r * materialRetention +
          horizonRgb.r * atmosphericInfluence
      ),
      g: Math.round(
        litChimneyRgb.g * materialRetention +
          horizonRgb.g * atmosphericInfluence
      ),
      b: Math.round(
        litChimneyRgb.b * materialRetention +
          horizonRgb.b * atmosphericInfluence
      ),
    };
    this.chimneyBackground = `rgb(${blendedChimneyRgb.r}, ${blendedChimneyRgb.g}, ${blendedChimneyRgb.b})`;
  }
}
