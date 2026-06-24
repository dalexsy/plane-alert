import SunCalc from 'suncalc';
import type { AstronomicalData, WeatherData } from './environmental-types';

const WEATHER_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699';

export function locationDistanceKm(
  point1: { lat: number; lon: number },
  point2: { lat: number; lon: number }
): number {
  const R = 6371;
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((point1.lat * Math.PI) / 180) * Math.cos((point2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    const data = await response.json();
    const windSpeed = data.wind?.speed || 0;
    let windStat = 0;
    if (windSpeed >= 6) windStat = 3;
    else if (windSpeed >= 3) windStat = 2;
    else if (windSpeed >= 0.5) windStat = 1;
    return {
      windDirection: data.wind?.deg || 0,
      windSpeed,
      windStat,
      temperature: data.main?.temp,
      humidity: data.main?.humidity,
      pressure: data.main?.pressure,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.warn('Weather API failed:', error);
    return { windDirection: 0, windSpeed: 0, windStat: 0, lastUpdated: Date.now() };
  }
}

export function getMoonPhaseName(phase: number): string {
  if (phase < 0.1 || phase > 0.9) return 'New Moon';
  if (phase < 0.3) return 'Waxing Crescent';
  if (phase < 0.4) return 'First Quarter';
  if (phase < 0.6) return 'Waxing Gibbous';
  if (phase < 0.7) return 'Full Moon';
  if (phase < 0.9) return 'Waning Gibbous';
  return 'Last Quarter';
}

function millisecondsToHoursMinutes(ms: number): { hours: number; minutes: number } {
  return { hours: Math.floor(ms / (1000 * 60 * 60)), minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)) };
}

function calculateNextSunEvent(now: Date, lat: number, lon: number, isNight: boolean): string {
  const sunTimes = SunCalc.getTimes(now, lat, lon);
  const currentTime = now.getTime();
  if (isNight) {
    let sunriseDate = sunTimes.sunrise;
    if (sunriseDate.getTime() <= currentTime) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      sunriseDate = SunCalc.getTimes(tomorrow, lat, lon).sunrise;
    }
    const { hours, minutes } = millisecondsToHoursMinutes(Math.max(0, sunriseDate.getTime() - currentTime));
    return `Sunrise ${hours}h ${minutes}m`;
  }
  const { hours, minutes } = millisecondsToHoursMinutes(Math.max(0, sunTimes.sunset.getTime() - currentTime));
  return `Sunset ${hours}h ${minutes}m`;
}

export function calculateAstronomicalData(lat: number, lon: number): AstronomicalData {
  const now = new Date();
  const sunPos = SunCalc.getPosition(now, lat, lon);
  const sunAngle = ((sunPos.azimuth * 180) / Math.PI + 180) % 360;
  const moonPos = SunCalc.getMoonPosition(now, lat, lon);
  const moonIllum = SunCalc.getMoonIllumination(now);
  const moonAngle = ((moonPos.azimuth * 180) / Math.PI + 180) % 360;
  const isNight = sunPos.altitude < 0;
  return {
    sunAngle: isNight ? moonAngle : sunAngle,
    moonAngle,
    isNight,
    moonFraction: moonIllum.fraction,
    moonPhase: getMoonPhaseName(moonIllum.phase),
    moonIsWaning: moonIllum.phase > 0.5,
    sunEventText: calculateNextSunEvent(now, lat, lon, isNight),
    lastUpdated: Date.now(),
  };
}

export function getWindIntensityText(stat: number): string {
  switch (stat) {
    case 0: return 'Calm';
    case 1: return 'Light';
    case 2: return 'Moderate';
    case 3: return 'Strong';
    default: return 'Unknown';
  }
}

export function getWindCompassDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round((degrees % 360) / 22.5) % 16];
}

export function convertWindSpeed(speedMs: number, unit: string): number {
  switch (unit) {
    case 'knots': return speedMs * 1.94384;
    case 'km/h': return speedMs * 3.6;
    case 'mph': return speedMs * 2.23694;
    default: return speedMs;
  }
}
