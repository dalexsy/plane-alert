import * as SunCalc from 'suncalc';

export const BRIGHTNESS_LEVELS = {
  DAYTIME_MIN: 0.7,
  DAYTIME_DIM_FACTOR: 0.3,
  CIVIL_MIN: 0.25,
  CIVIL_MAX: 0.7,
  NAUTICAL_MIN: 0.1,
  NAUTICAL_MAX: 0.25,
  ASTRO_MIN: 0.05,
  ASTRO_MAX: 0.1,
  NIGHT: 0.3,
  ABSOLUTE_MIN: 0.0,
  ABSOLUTE_MAX: 1.0,
};

export function calculateAutoBrightness(
  lat: number,
  lon: number,
  manualBrightness: number,
  autoEnabled: boolean,
): number {
  if (!autoEnabled) {
    return manualBrightness;
  }

  const now = new Date();
  const sunPos = SunCalc.getPosition(now, lat, lon);
  const sunElevationDegrees = (sunPos.altitude * 180) / Math.PI;

  let brightness: number;

  if (sunElevationDegrees > 0) {
    brightness = Math.max(
      BRIGHTNESS_LEVELS.DAYTIME_MIN,
      1 -
        (1 - sunElevationDegrees / 30) * BRIGHTNESS_LEVELS.DAYTIME_DIM_FACTOR,
    );
  } else if (sunElevationDegrees > -6) {
    const range = BRIGHTNESS_LEVELS.CIVIL_MAX - BRIGHTNESS_LEVELS.CIVIL_MIN;
    brightness =
      BRIGHTNESS_LEVELS.CIVIL_MIN + ((sunElevationDegrees + 6) / 6) * range;
  } else if (sunElevationDegrees > -12) {
    const range =
      BRIGHTNESS_LEVELS.NAUTICAL_MAX - BRIGHTNESS_LEVELS.NAUTICAL_MIN;
    brightness =
      BRIGHTNESS_LEVELS.NAUTICAL_MIN +
      ((sunElevationDegrees + 12) / 6) * range;
  } else if (sunElevationDegrees > -18) {
    const range = BRIGHTNESS_LEVELS.ASTRO_MAX - BRIGHTNESS_LEVELS.ASTRO_MIN;
    brightness =
      BRIGHTNESS_LEVELS.ASTRO_MIN +
      ((sunElevationDegrees + 18) / 6) * range;
  } else {
    brightness = BRIGHTNESS_LEVELS.NIGHT;
  }

  return Math.max(
    BRIGHTNESS_LEVELS.ABSOLUTE_MIN,
    Math.min(BRIGHTNESS_LEVELS.ABSOLUTE_MAX, brightness),
  );
}

export function buildBrightnessStatusText(state: {
  mode: string;
  brightness: number;
  isDayTime: boolean;
  sunElevation: number;
}): string {
  if (state.mode === 'manual') {
    return `Manual brightness: ${Math.round(state.brightness * 100)}%`;
  }
  if (state.isDayTime) {
    return `Auto: Daytime (${Math.round(state.brightness * 100)}%)`;
  }
  if (state.sunElevation > -6) {
    return `Auto: Civil twilight (${Math.round(state.brightness * 100)}%)`;
  }
  if (state.sunElevation > -12) {
    return `Auto: Nautical twilight (${Math.round(state.brightness * 100)}%)`;
  }
  if (state.sunElevation > -18) {
    return `Auto: Astronomical twilight (${Math.round(state.brightness * 100)}%)`;
  }
  return `Auto: Night (${Math.round(state.brightness * 100)}%)`;
}
