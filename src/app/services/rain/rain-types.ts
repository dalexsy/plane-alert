export interface RainConfiguration {
  dropCount: number;
  intensity: number;
  windAngle: number;
  fallSpeed: number;
  sizeVariance: number;
  opacity: number;
  color: string;
}

export interface RainDrop {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
  duration: number;
}

export interface WeatherRainMapping {
  drizzle: number;
  lightRain: number;
  moderateRain: number;
  heavyRain: number;
  thunderstorm: number;
}

export const DEFAULT_RAIN_CONFIG: RainConfiguration = {
  dropCount: 150,
  intensity: 0.7,
  windAngle: 0,
  fallSpeed: 800,
  sizeVariance: 1.2,
  opacity: 0.6,
  color: 'rgba(200, 220, 255, 0.8)',
};

export const WEATHER_INTENSITY_MAP: WeatherRainMapping = {
  drizzle: 0.3,
  lightRain: 0.5,
  moderateRain: 0.7,
  heavyRain: 0.9,
  thunderstorm: 1.0,
};
