type Rgb = { r: number; g: number; b: number };

export function getNightSkyColors(): { bottomColor: string; topColor: string } {
  return { bottomColor: 'rgb(12, 18, 35)', topColor: 'rgb(8, 12, 25)' };
}

export function getDeepTwilightColors(sunElevation: number): { bottomColor: string; topColor: string } {
  const factor = (sunElevation + 18) / 6;
  const bottom = { r: Math.round(12 + factor * 20), g: Math.round(18 + factor * 25), b: Math.round(35 + factor * 45) };
  const top = { r: Math.round(8 + factor * 12), g: Math.round(12 + factor * 18), b: Math.round(25 + factor * 35) };
  return { bottomColor: rgb(bottom), topColor: rgb(top) };
}

export function getCivilTwilightColors(sunElevation: number): { bottomColor: string; topColor: string } {
  const factor = (sunElevation + 12) / 6;
  const bottom = { r: Math.round(32 + factor * 48), g: Math.round(43 + factor * 62), b: Math.round(80 + factor * 75) };
  const top = { r: Math.round(20 + factor * 25), g: Math.round(30 + factor * 35), b: Math.round(60 + factor * 55) };
  return { bottomColor: rgb(bottom), topColor: rgb(top) };
}

export function getSunriseSunsetColors(sunElevation: number): { bottomColor: string; topColor: string } {
  const factor = (sunElevation + 6) / 6;
  const warmth = Math.sin(factor * Math.PI) * 0.8;
  const bottom = {
    r: Math.round(80 + factor * 135 + warmth * 60),
    g: Math.round(105 + factor * 115 + warmth * 45),
    b: Math.round(155 + factor * 100 - warmth * 40),
  };
  const top = {
    r: Math.round(45 + factor * 75 + warmth * 40),
    g: Math.round(65 + factor * 95 + warmth * 30),
    b: Math.round(115 + factor * 140 - warmth * 20),
  };
  return { bottomColor: rgb(bottom), topColor: rgb(top) };
}

export function calculateAtmosphericScattering(sunElevationRadians: number, turbidity: number) {
  const lambda = { red: 650, green: 510, blue: 475 };
  const scattering = {
    red: Math.pow(lambda.blue / lambda.red, 4),
    green: Math.pow(lambda.blue / lambda.green, 4),
    blue: 1.0,
  };
  const airMass =
    1 /
    (Math.cos(Math.PI / 2 - sunElevationRadians) +
      0.025 * Math.exp(-11 * Math.cos(Math.PI / 2 - sunElevationRadians)));
  const extinction = Math.exp(-0.1 * turbidity * airMass);
  const baseLuminance = 0.3 + 0.7 * Math.sin(sunElevationRadians);
  const zenithIntensity = baseLuminance * extinction;
  const horizonIntensity = baseLuminance * extinction * 0.6;
  const zenithColor: Rgb = {
    r: Math.min(255, 135 + 120 * zenithIntensity * scattering.red),
    g: Math.min(255, 150 + 105 * zenithIntensity * scattering.green),
    b: Math.min(255, 200 + 55 * zenithIntensity * scattering.blue),
  };
  const horizonColor: Rgb = {
    r: Math.min(255, 180 + 75 * horizonIntensity),
    g: Math.min(255, 190 + 65 * horizonIntensity),
    b: Math.min(255, 220 + 35 * horizonIntensity),
  };
  if (sunElevationRadians < Math.PI / 6) {
    const warmingFactor = 1 - sunElevationRadians / (Math.PI / 6);
    horizonColor.r = Math.min(255, horizonColor.r + 60 * warmingFactor);
    horizonColor.g = Math.min(255, horizonColor.g + 20 * warmingFactor);
    horizonColor.b = Math.max(100, horizonColor.b - 40 * warmingFactor);
  }
  return { zenith: zenithColor, horizon: horizonColor };
}

function blend(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r * t + b.r * (1 - t), g: a.g * t + b.g * (1 - t), b: a.b * t + b.b * (1 - t) };
}

function rgb(c: Rgb): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function applyWeatherEffects(
  baseColors: { zenith: Rgb; horizon: Rgb },
  weatherCondition?: string,
  weatherDescription?: string,
  sunElevation?: number
): { bottomColor: string; topColor: string } {
  const condition = weatherCondition?.toLowerCase() || '';
  const description = weatherDescription?.toLowerCase() || '';
  let { zenith, horizon } = baseColors;

  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunderstorm')) {
    const isThunder = condition.includes('thunderstorm');
    const se = typeof sunElevation === 'number' ? sunElevation : 45;
    const dayFactor = Math.max(0, Math.min(1, (se + 6) / 36));
    const rainZenith = isThunder ? { r: 50, g: 55, b: 70 } : { r: 120, g: 130, b: 150 };
    const rainHorizon = isThunder ? { r: 70, g: 75, b: 90 } : { r: 160, g: 170, b: 185 };
    const rainBlend = isThunder ? 0.5 + 0.3 * (1 - dayFactor) : 0.3 + 0.3 * (1 - dayFactor);
    zenith = blend(zenith, rainZenith, 1 - rainBlend);
    horizon = blend(horizon, rainHorizon, 1 - rainBlend);
    if (isThunder) {
      zenith.b += 15;
      horizon.b += 10;
    }
  } else if (condition.includes('snow')) {
    const brightness = 1.4;
    zenith = scale(zenith, brightness);
    horizon = scale(horizon, brightness);
  } else if (condition.includes('cloud')) {
    const cloudFactor = description.includes('overcast')
      ? 0.4
      : description.includes('broken')
        ? 0.6
        : description.includes('scattered')
          ? 0.8
          : 0.7;
    const grayZenith = (zenith.r + zenith.g + zenith.b) / 3;
    const grayHorizon = (horizon.r + horizon.g + horizon.b) / 3;
    zenith = mixGray(zenith, grayZenith, cloudFactor);
    horizon = mixGray(horizon, grayHorizon, cloudFactor);
  }

  return { bottomColor: rgb(horizon), topColor: rgb(zenith) };
}

function scale(c: Rgb, factor: number): Rgb {
  return { r: Math.min(255, c.r * factor), g: Math.min(255, c.g * factor), b: Math.min(255, c.b * factor) };
}

function mixGray(c: Rgb, gray: number, factor: number): Rgb {
  return {
    r: c.r * factor + gray * (1 - factor),
    g: c.g * factor + gray * (1 - factor),
    b: c.b * factor + gray * (1 - factor),
  };
}

export function calculateTurbidityFromWeather(weatherCondition?: string, visibility?: number): number {
  if (visibility) return Math.max(1, Math.min(10, 15 / visibility));
  const condition = weatherCondition?.toLowerCase() || '';
  if (condition.includes('clear')) return 1.5;
  if (condition.includes('few clouds') || condition.includes('scattered')) return 2.0;
  if (condition.includes('broken clouds')) return 3.0;
  if (condition.includes('overcast')) return 4.0;
  if (condition.includes('haze') || condition.includes('mist')) return 6.0;
  if (condition.includes('fog')) return 8.0;
  if (condition.includes('dust') || condition.includes('sand')) return 9.0;
  return 2.5;
}
