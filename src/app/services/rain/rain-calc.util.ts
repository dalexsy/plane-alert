import {
  RainConfiguration,
  RainDrop,
  WeatherRainMapping,
  DEFAULT_RAIN_CONFIG,
  WEATHER_INTENSITY_MAP,
} from './rain-types';

export function shouldActivateRain(condition: string, description: string): boolean {
  return (
    condition.includes('rain') ||
    condition.includes('drizzle') ||
    condition.includes('thunderstorm') ||
    description.includes('rain') ||
    description.includes('drizzle') ||
    description.includes('shower')
  );
}

export function calculateRainIntensity(
  condition: string,
  description: string,
  humidity = 50,
  pressure = 1013.25,
  temperature = 288.15,
  weatherMap: WeatherRainMapping = WEATHER_INTENSITY_MAP
): number {
  let baseIntensity = weatherMap.moderateRain;
  if (description.includes('heavy') || description.includes('extreme')) {
    baseIntensity = weatherMap.heavyRain;
  } else if (description.includes('moderate')) {
    baseIntensity = weatherMap.moderateRain;
  } else if (description.includes('light') || description.includes('slight')) {
    baseIntensity = weatherMap.lightRain;
  } else if (description.includes('drizzle')) {
    baseIntensity = weatherMap.drizzle;
  }
  if (condition.includes('thunderstorm')) {
    baseIntensity = Math.max(baseIntensity, weatherMap.thunderstorm);
  } else if (condition.includes('drizzle')) {
    baseIntensity = Math.min(baseIntensity, weatherMap.drizzle);
  }
  let intensityModifier = 1.0;
  intensityModifier *= Math.max(0.7, Math.min(1.3, humidity / 70));
  intensityModifier *= Math.max(0.8, Math.min(1.2, 1013.25 / pressure));
  const tempCelsius = temperature - 273.15;
  const tempFactor =
    tempCelsius > 15
      ? Math.min(1.15, 1 + (tempCelsius - 15) * 0.01)
      : Math.max(0.85, 1 - (15 - tempCelsius) * 0.005);
  intensityModifier *= tempFactor;
  return Math.max(0.1, Math.min(1.0, baseIntensity * intensityModifier));
}

export function calculateWindEffect(windSpeed: number, windDirection: number): number {
  const maxWindAngle = 45;
  const maxWindSpeed = 15;
  const windEffect = Math.min(windSpeed / maxWindSpeed, 1.0);
  const baseAngle = windEffect * maxWindAngle;
  const normalizedDirection = ((windDirection + 180) % 360) - 180;
  const directionFactor = Math.sin((normalizedDirection * Math.PI) / 180);
  return baseAngle * directionFactor;
}

export function calculateFallSpeed(
  intensity: number,
  pressure: number,
  temperature: number,
  humidity: number,
  baseFallSpeed = DEFAULT_RAIN_CONFIG.fallSpeed
): number {
  let fallSpeed = baseFallSpeed;
  fallSpeed *= 0.7 + intensity * 0.6;
  const airDensityRatio = (pressure / 1013.25) * (288.15 / temperature);
  fallSpeed *= Math.max(0.8, Math.min(1.2, 2 - airDensityRatio));
  fallSpeed *= Math.max(0.95, 1 - (humidity - 50) * 0.002);
  return Math.max(400, Math.min(1200, fallSpeed));
}

export function calculateDropCount(
  intensity: number,
  visibility: number,
  humidity: number,
  baseDropCount = DEFAULT_RAIN_CONFIG.dropCount
): number {
  let dropCount = baseDropCount;
  dropCount *= 0.5 + intensity * 1.0;
  const visibilityKm = Math.max(0.1, visibility / 1000);
  const visibilityFactor =
    visibilityKm > 10 ? 1.0 : Math.max(0.8, Math.min(1.4, 1 + (10 - visibilityKm) * 0.06));
  dropCount *= visibilityFactor;
  dropCount *= Math.max(0.8, Math.min(1.2, humidity / 75));
  return Math.round(Math.max(50, Math.min(300, dropCount)));
}

export function calculateSizeVariance(
  intensity: number,
  pressure: number,
  humidity: number,
  baseVariance = DEFAULT_RAIN_CONFIG.sizeVariance
): number {
  let sizeVariance = baseVariance;
  sizeVariance *= 0.8 + intensity * 0.8;
  sizeVariance *= Math.max(0.9, Math.min(1.3, 1013.25 / pressure));
  sizeVariance *= Math.max(0.95, Math.min(1.15, humidity / 75));
  return Math.max(0.8, Math.min(2.5, sizeVariance));
}

export function calculateRainColor(
  condition: string,
  description: string,
  temperature: number,
  visibility: number
): string {
  let baseColor = { r: 200, g: 220, b: 255, a: 0.8 };
  const tempCelsius = temperature - 273.15;
  if (tempCelsius < 5) {
    baseColor.r = Math.max(150, baseColor.r - 30);
    baseColor.g = Math.max(180, baseColor.g - 20);
    baseColor.b = Math.max(200, baseColor.b - 10);
  } else if (tempCelsius > 25) {
    baseColor.a = Math.max(0.6, baseColor.a - 0.1);
    baseColor.g = Math.min(255, baseColor.g + 15);
  }
  if (condition.includes('thunderstorm')) {
    baseColor.r = Math.max(120, baseColor.r - 50);
    baseColor.g = Math.max(140, baseColor.g - 50);
    baseColor.b = Math.max(180, baseColor.b - 40);
    baseColor.a = Math.min(0.95, baseColor.a + 0.2);
  } else if (description.includes('heavy')) {
    baseColor.r = Math.max(170, baseColor.r - 20);
    baseColor.g = Math.max(190, baseColor.g - 20);
    baseColor.a = Math.min(0.9, baseColor.a + 0.1);
  } else if (description.includes('drizzle') || description.includes('light')) {
    baseColor.a = Math.max(0.4, baseColor.a - 0.3);
  }
  if (visibility < 5000) {
    baseColor.r = Math.max(150, baseColor.r - 30);
    baseColor.g = Math.max(170, baseColor.g - 30);
    baseColor.b = Math.max(200, baseColor.b - 30);
    baseColor.a = Math.min(0.95, baseColor.a + 0.15);
  }
  return `rgba(${Math.round(baseColor.r)}, ${Math.round(baseColor.g)}, ${Math.round(
    baseColor.b
  )}, ${baseColor.a})`;
}

export function createRainDrop(id: string, config: RainConfiguration): RainDrop {
  const x = Math.random() * 120 - 10;
  const y = -Math.random() * 20 - 5;
  const size = 0.5 + Math.random() * (config.sizeVariance - 0.5);
  const speed = 0.8 + Math.random() * 0.4;
  const opacity = Math.max(0.1, config.opacity + (Math.random() - 0.5) * 0.3);
  const delay = Math.random() * 2000;
  const duration = 3000 / speed;
  return { id, x, y, size, speed, opacity, delay, duration };
}

export function generateRainDrops(config: RainConfiguration): RainDrop[] {
  const drops: RainDrop[] = [];
  for (let i = 0; i < config.dropCount; i++) {
    drops.push(createRainDrop(i.toString(), config));
  }
  return drops;
}

export function updateRainDropPositions(
  drops: RainDrop[],
  config: RainConfiguration,
  deltaTime: number
): RainDrop[] {
  return drops.map((drop) => {
    const fallDistance = (config.fallSpeed * drop.speed * deltaTime) / 1000;
    const fallPercentage = (fallDistance / window.innerHeight) * 100;
    const windEffect = (config.windAngle / 45) * 0.5;
    const newX = drop.x + windEffect;
    const newY = drop.y + fallPercentage;
    if (newY > 105) return createRainDrop(drop.id, config);
    return { ...drop, x: newX, y: newY };
  });
}

export function fadeRainDropsStep(drops: RainDrop[]): RainDrop[] {
  return drops.map((drop) => ({ ...drop, opacity: drop.opacity * 0.9 }));
}

export function getIntensityForDescription(
  description: string,
  weatherMap: WeatherRainMapping = WEATHER_INTENSITY_MAP
): number {
  const lower = description.toLowerCase();
  if (lower.includes('thunderstorm')) return weatherMap.thunderstorm;
  if (lower.includes('heavy')) return weatherMap.heavyRain;
  if (lower.includes('moderate')) return weatherMap.moderateRain;
  if (lower.includes('drizzle')) return weatherMap.drizzle;
  if (lower.includes('light') || lower.includes('slight')) return weatherMap.lightRain;
  return weatherMap.moderateRain;
}
