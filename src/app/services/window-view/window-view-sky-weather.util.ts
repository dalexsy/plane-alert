import type { RainService } from '../rain/rain.service';
import type { StormPressureService } from '../storm-pressure/storm-pressure.service';
import type { WindowViewPlane } from '../../types/window-view-plane';

export function applyWindowViewRainFromWeather(
  weatherData: unknown,
  rainService: RainService,
  stormPressureService: StormPressureService
): void {
  const data = weatherData as {
    weather?: { main?: string; description?: string }[];
    main?: { humidity?: number; pressure?: number; temp?: number };
    wind?: { speed?: number; deg?: number };
    visibility?: number;
  } | null;

  if (!data?.weather?.length) {
    rainService.stopRain();
    return;
  }
  const weather = data.weather[0];
  const condition = weather.main?.toLowerCase() || '';
  const description = weather.description?.toLowerCase() || '';
  const isRaining =
    condition.includes('rain') ||
    condition.includes('drizzle') ||
    condition.includes('thunderstorm');
  const humidity = data.main?.humidity || 50;
  const pressure = data.main?.pressure || 1013.25;
  const temperature = data.main?.temp || 288.15;
  const windSpeed = data.wind?.speed || 0;
  const windDirection = data.wind?.deg || 0;
  const visibility = data.visibility || 10000;

  if (isRaining) {
    rainService.updateWeatherConditions(
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
    rainService.stopRain();
  }
  stormPressureService.updatePressure(pressure, temperature, humidity, windSpeed);
}

export function resolveWindowViewWeatherKind(
  weatherCondition: string | null,
  weatherDescription: string | null
): 'clear' | 'rain' | 'snow' | 'clouds' {
  if (!weatherCondition) return 'clear';
  const cond = weatherCondition.toLowerCase();
  const desc = weatherDescription?.toLowerCase() || '';
  if (
    cond.includes('rain') ||
    cond.includes('drizzle') ||
    cond.includes('thunderstorm')
  ) {
    return 'rain';
  }
  if (cond.includes('snow')) return 'snow';
  if (
    cond.includes('cloud') &&
    !desc.includes('few') &&
    !desc.includes('scattered')
  ) {
    return 'clouds';
  }
  return 'clear';
}

export function computeWindowViewCloudPresentation(
  planes: WindowViewPlane[],
  sunElevationAngle: number
): { cloudFilter: string; cloudBacklightClass: string } {
  const moon = planes.find((p) => p.isCelestial && p.celestialBodyType === 'moon');
  if (sunElevationAngle > 15) {
    return { cloudFilter: 'none', cloudBacklightClass: 'backlit' };
  }
  if (sunElevationAngle > 0) {
    const brightness = 0.4 + (sunElevationAngle / 15) * 0.6;
    return {
      cloudFilter: `brightness(${brightness}) contrast(1.1) hue-rotate(5deg)`,
      cloudBacklightClass: 'twilight-backlit',
    };
  }
  if (sunElevationAngle > -6) {
    const brightness = 0.25 + ((sunElevationAngle + 6) / 6) * 0.15;
    return {
      cloudFilter: `brightness(${brightness}) contrast(1.2) hue-rotate(10deg) saturate(0.8)`,
      cloudBacklightClass: 'twilight-backlit',
    };
  }
  if (sunElevationAngle > -12) {
    const brightness = 0.15 + ((sunElevationAngle + 12) / 6) * 0.1;
    return {
      cloudFilter: `brightness(${brightness}) contrast(1.3) hue-rotate(15deg) saturate(0.6)`,
      cloudBacklightClass: 'night-backlit',
    };
  }
  let moonInfluence = 0.1;
  if (moon && !moon.belowHorizon) {
    const moonElevation = (moon.y / 100) * 90;
    const moonPhase = moon.moonFraction || 0;
    moonInfluence = 0.1 + (moonElevation / 90) * 0.15 + moonPhase * 0.1;
  }
  const baseBrightness = 0.1 + moonInfluence * 0.5;
  return {
    cloudFilter: `brightness(${baseBrightness}) contrast(1.4) hue-rotate(20deg) saturate(0.4)`,
    cloudBacklightClass: 'night-backlit',
  };
}

export function computeSunElevationFromPlanes(planes: WindowViewPlane[]): number {
  const sun = planes.find((p) => p.isCelestial && p.celestialBodyType === 'sun');
  if (sun && !sun.belowHorizon) return (sun.y / 100) * 90;
  return sun ? -10 : -20;
}
