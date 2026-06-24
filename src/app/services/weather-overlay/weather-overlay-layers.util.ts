import * as L from 'leaflet';
import type { SkyColors } from '../weather-overlay.service';

const OPEN_WEATHER_MAP_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699';

export type WeatherLayerCtx = {
  map: L.Map | null;
  cloudLayer: L.TileLayer | null;
  rainLayer: L.TileLayer | null;
  showCloudCover: boolean;
  showRainCover: boolean;
  cloudOpacity: number;
  rainOpacity: number;
  setCloudLayer(layer: L.TileLayer | null): void;
  setRainLayer(layer: L.TileLayer | null): void;
};

export function updateCloudLayer(ctx: WeatherLayerCtx): void {
  if (!ctx.map) return;
  if (ctx.cloudLayer) {
    ctx.map.removeLayer(ctx.cloudLayer);
    ctx.setCloudLayer(null);
  }
  if (!ctx.showCloudCover) return;
  if (!ctx.map.getPane('cloudPane')) {
    ctx.map.createPane('cloudPane');
    const cloudPane = ctx.map.getPane('cloudPane') as HTMLElement;
    cloudPane.style.zIndex = '620';
    cloudPane.style.pointerEvents = 'none';
  }
  ctx.setCloudLayer(
    L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`, {
      pane: 'cloudPane', className: 'cloud-layer', opacity: ctx.cloudOpacity, attribution: 'Weather data © OpenWeatherMap',
    }).addTo(ctx.map).on('tileerror', () => {})
  );
}

export function updateRainLayer(ctx: WeatherLayerCtx): void {
  if (!ctx.map) return;
  if (ctx.rainLayer) {
    ctx.map.removeLayer(ctx.rainLayer);
    ctx.setRainLayer(null);
  }
  if (!ctx.showRainCover) return;
  if (!ctx.map.getPane('rainPane')) {
    ctx.map.createPane('rainPane');
    const rainPane = ctx.map.getPane('rainPane') as HTMLElement;
    rainPane.style.zIndex = '615';
    rainPane.style.pointerEvents = 'none';
  }
  ctx.setRainLayer(
    L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPEN_WEATHER_MAP_API_KEY}`, {
      pane: 'rainPane', className: 'rain-layer', opacity: ctx.rainOpacity, attribution: 'Weather data © OpenWeatherMap',
    }).addTo(ctx.map).on('tileerror', () => {})
  );
}

function extractRgbFromColor(color: string): { r: number; g: number; b: number } | null {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 6) return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
  }
  return null;
}

function calculateHueShift(r: number, g: number, b: number): number {
  if (r > g && r > b) return -10 + (g / 255) * 20;
  if (b > r && b > g) return 10 - (r / 255) * 20;
  return 0;
}

export function createCloudLayerFilter(bottomColor: string, topColor: string): string {
  const bottomRgb = extractRgbFromColor(bottomColor);
  const topRgb = extractRgbFromColor(topColor);
  if (!bottomRgb || !topRgb) return '';
  const avgR = Math.round((bottomRgb.r + topRgb.r) / 2);
  const avgG = Math.round((bottomRgb.g + topRgb.g) / 2);
  const avgB = Math.round((bottomRgb.b + topRgb.b) / 2);
  const brightness = (avgR + avgG + avgB) / (3 * 255);
  const saturation = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  const hueShift = calculateHueShift(avgR, avgG, avgB);
  const saturationAdjust = Math.max(0.8, Math.min(1.2, 1 + (saturation / 255) * 0.3));
  const brightnessAdjust = Math.max(0.7, Math.min(1.3, brightness * 1.2));
  return `hue-rotate(${hueShift}deg) saturate(${saturationAdjust}) brightness(${brightnessAdjust}) contrast(1.1)`;
}

export function applySkyColorsToCloudElements(skyColors: SkyColors): void {
  const filter = createCloudLayerFilter(skyColors.bottomColor, skyColors.topColor);
  document.querySelectorAll('.cloud-layer').forEach((element) => {
    const el = element as HTMLElement;
    el.style.filter = filter;
    el.style.mixBlendMode = 'multiply';
  });
}

export function getWindDescription(speedMs: number): string {
  const speedKmh = speedMs * 3.6;
  if (speedKmh < 1) return 'Calm';
  if (speedKmh < 6) return 'Light air';
  if (speedKmh < 12) return 'Light breeze';
  if (speedKmh < 20) return 'Gentle breeze';
  if (speedKmh < 29) return 'Moderate breeze';
  if (speedKmh < 39) return 'Fresh breeze';
  if (speedKmh < 50) return 'Strong breeze';
  if (speedKmh < 62) return 'Near gale';
  if (speedKmh < 75) return 'Gale';
  if (speedKmh < 89) return 'Strong gale';
  if (speedKmh < 103) return 'Storm';
  if (speedKmh < 118) return 'Violent storm';
  return 'Hurricane';
}

export function getWindFromDirection(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round((deg % 360) / 22.5) % 16];
}

export function convertWindSpeed(speedMs: number, unit: string): number {
  switch (unit) {
    case 'knots': return Math.round(speedMs * 1.94384 * 100) / 100;
    case 'km/h': return Math.round(speedMs * 3.6 * 100) / 100;
    case 'mph': return Math.round(speedMs * 2.23694 * 100) / 100;
    default: return Math.round(speedMs * 100) / 100;
  }
}
