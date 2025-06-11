import { Injectable } from '@angular/core';

/**
 * Service for calculating realistic sky colors based on atmospheric scattering
 * Implements simplified Preetham sky model and Rayleigh scattering
 */
@Injectable({
  providedIn: 'root',
})
export class AtmosphericSkyService {
  /**
   * Calculate realistic sky color based on sun position and atmospheric conditions
   * @param sunElevationDegrees Sun elevation angle in degrees (0 = horizon, 90 = zenith)
   * @param weatherCondition Weather condition string
   * @param weatherDescription Detailed weather description
   * @param turbidity Atmospheric turbidity (1.0 = very clear, 10.0 = very hazy)
   * @returns Object with bottom and top colors for gradient
   */ calculateSkyColors(
    sunElevationDegrees: number,
    weatherCondition?: string,
    weatherDescription?: string,
    turbidity: number = 2.0
  ): { bottomColor: string; topColor: string } {
    // Don't clamp negative values - we need them for night/twilight calculations
    const sunElevation = sunElevationDegrees;

    // Handle night time (sun well below horizon)
    if (sunElevation <= -18) {
      return this.getNightSkyColors();
    }

    // Handle deep twilight (nautical twilight)
    if (sunElevation <= -12) {
      return this.getDeepTwilightColors(sunElevation);
    }

    // Handle civil twilight
    if (sunElevation <= -6) {
      return this.getCivilTwilightColors(sunElevation);
    }

    // Handle sunrise/sunset period
    if (sunElevation <= 0) {
      return this.getSunriseSunsetColors(sunElevation);
    }

    // Convert to radians for positive elevation angles
    const theta = (sunElevation * Math.PI) / 180;

    // Calculate base atmospheric scattering colors for daytime
    const baseColors = this.calculateAtmosphericScattering(theta, turbidity);

    // Apply weather modifications
    return this.applyWeatherEffects(
      baseColors,
      weatherCondition,
      weatherDescription,
      sunElevation
    );
  }

  /**
   * Calculate atmospheric scattering using simplified Rayleigh scattering
   */
  private calculateAtmosphericScattering(
    sunElevationRadians: number,
    turbidity: number
  ) {
    // Rayleigh scattering coefficients (wavelength dependent)
    const lambda = {
      red: 650, // nm
      green: 510, // nm
      blue: 475, // nm
    };

    // Scattering intensity is proportional to 1/λ^4
    const scattering = {
      red: Math.pow(lambda.blue / lambda.red, 4),
      green: Math.pow(lambda.blue / lambda.green, 4),
      blue: 1.0,
    };

    // Air mass calculation (approximation)
    const airMass =
      1 /
      (Math.cos(Math.PI / 2 - sunElevationRadians) +
        0.025 * Math.exp(-11 * Math.cos(Math.PI / 2 - sunElevationRadians)));

    // Atmospheric extinction
    const extinction = Math.exp(-0.1 * turbidity * airMass);

    // Base sky luminance
    const baseLuminance = 0.3 + 0.7 * Math.sin(sunElevationRadians);

    // Calculate RGB values with scattering
    const zenithIntensity = baseLuminance * extinction;
    const horizonIntensity = baseLuminance * extinction * 0.6; // Horizon is dimmer

    // Apply wavelength-dependent scattering
    const zenithColor = {
      r: Math.min(255, 135 + 120 * zenithIntensity * scattering.red),
      g: Math.min(255, 150 + 105 * zenithIntensity * scattering.green),
      b: Math.min(255, 200 + 55 * zenithIntensity * scattering.blue),
    };

    const horizonColor = {
      r: Math.min(255, 180 + 75 * horizonIntensity),
      g: Math.min(255, 190 + 65 * horizonIntensity),
      b: Math.min(255, 220 + 35 * horizonIntensity),
    };

    // Add sunset/sunrise warming effect when sun is low
    if (sunElevationRadians < Math.PI / 6) {
      // < 30 degrees
      const warmingFactor = 1 - sunElevationRadians / (Math.PI / 6);
      horizonColor.r = Math.min(255, horizonColor.r + 60 * warmingFactor);
      horizonColor.g = Math.min(255, horizonColor.g + 20 * warmingFactor);
      horizonColor.b = Math.max(100, horizonColor.b - 40 * warmingFactor);
    }

    return {
      zenith: zenithColor,
      horizon: horizonColor,
    };
  }

  /**
   * Apply weather effects to base sky colors
   */
  private applyWeatherEffects(
    baseColors: { zenith: any; horizon: any },
    weatherCondition?: string,
    weatherDescription?: string,
    sunElevation?: number
  ) {
    const condition = weatherCondition?.toLowerCase() || '';
    const description = weatherDescription?.toLowerCase() || '';

    let { zenith, horizon } = baseColors;

    // Rain and storms - darken/desaturate, but scale with sun elevation
    if (
      condition.includes('rain') ||
      condition.includes('drizzle') ||
      condition.includes('thunderstorm')
    ) {
      // Default: blend with gray, but not night-like unless sun is very low
      // Use a stronger effect for thunderstorms
      const isThunder = condition.includes('thunderstorm');
      // Sun elevation: 90 (zenith) to -18 (night)
      const se = typeof sunElevation === 'number' ? sunElevation : 45;
      // 1 = full day, 0 = night
      const dayFactor = Math.max(0, Math.min(1, (se + 6) / 36)); // 30+6=36, so above -6 is day/twilight
      // Target gray for rain (lighter for day, darker for night)
      const rainZenith = isThunder
        ? { r: 50, g: 55, b: 70 }
        : { r: 120, g: 130, b: 150 };
      const rainHorizon = isThunder
        ? { r: 70, g: 75, b: 90 }
        : { r: 160, g: 170, b: 185 };
      // Blend base sky with rain gray
      function blend(a: any, b: any, t: number) {
        return {
          r: a.r * t + b.r * (1 - t),
          g: a.g * t + b.g * (1 - t),
          b: a.b * t + b.b * (1 - t),
        };
      }
      // More gray as dayFactor drops (i.e., as it gets darker)
      const rainBlend = isThunder ? 0.5 + 0.3 * (1 - dayFactor) : 0.3 + 0.3 * (1 - dayFactor);
      zenith = blend(zenith, rainZenith, 1 - rainBlend);
      horizon = blend(horizon, rainHorizon, 1 - rainBlend);
      // Add slight purple tint for storms
      if (isThunder) {
        zenith.b += 15;
        horizon.b += 10;
      }
    }
    // Snow - bright, high contrast
    else if (condition.includes('snow')) {
      const brightness = 1.4;
      zenith.r = Math.min(255, zenith.r * brightness);
      zenith.g = Math.min(255, zenith.g * brightness);
      zenith.b = Math.min(255, zenith.b * brightness);
      horizon.r = Math.min(255, horizon.r * brightness);
      horizon.g = Math.min(255, horizon.g * brightness);
      horizon.b = Math.min(255, horizon.b * brightness);
    }
    // Clouds - reduce saturation and contrast
    else if (condition.includes('cloud')) {
      const cloudFactor = description.includes('overcast')
        ? 0.4
        : description.includes('broken')
        ? 0.6
        : description.includes('scattered')
        ? 0.8
        : 0.7;

      // Desaturate by moving toward gray
      const grayZenith = (zenith.r + zenith.g + zenith.b) / 3;
      const grayHorizon = (horizon.r + horizon.g + horizon.b) / 3;

      zenith.r = zenith.r * cloudFactor + grayZenith * (1 - cloudFactor);
      zenith.g = zenith.g * cloudFactor + grayZenith * (1 - cloudFactor);
      zenith.b = zenith.b * cloudFactor + grayZenith * (1 - cloudFactor);

      horizon.r = horizon.r * cloudFactor + grayHorizon * (1 - cloudFactor);
      horizon.g = horizon.g * cloudFactor + grayHorizon * (1 - cloudFactor);
      horizon.b = horizon.b * cloudFactor + grayHorizon * (1 - cloudFactor);
    }

    return {
      bottomColor: `rgb(${Math.round(horizon.r)}, ${Math.round(
        horizon.g
      )}, ${Math.round(horizon.b)})`,
      topColor: `rgb(${Math.round(zenith.r)}, ${Math.round(
        zenith.g
      )}, ${Math.round(zenith.b)})`,
    };
  }
  /**
   * Get night sky colors (astronomical twilight and darker)
   */
  private getNightSkyColors() {
    return {
      bottomColor: 'rgb(12, 18, 35)',
      topColor: 'rgb(8, 12, 25)',
    };
  }

  /**
   * Get deep twilight colors (nautical twilight: -18° to -12°)
   */
  private getDeepTwilightColors(sunElevation: number) {
    const factor = (sunElevation + 18) / 6; // 0 to 1

    const bottom = {
      r: Math.round(12 + factor * 20),
      g: Math.round(18 + factor * 25),
      b: Math.round(35 + factor * 45),
    };

    const top = {
      r: Math.round(8 + factor * 12),
      g: Math.round(12 + factor * 18),
      b: Math.round(25 + factor * 35),
    };

    return {
      bottomColor: `rgb(${bottom.r}, ${bottom.g}, ${bottom.b})`,
      topColor: `rgb(${top.r}, ${top.g}, ${top.b})`,
    };
  }

  /**
   * Get civil twilight colors (-12° to -6°)
   */
  private getCivilTwilightColors(sunElevation: number) {
    const factor = (sunElevation + 12) / 6; // 0 to 1

    const bottom = {
      r: Math.round(32 + factor * 48),
      g: Math.round(43 + factor * 62),
      b: Math.round(80 + factor * 75),
    };

    const top = {
      r: Math.round(20 + factor * 25),
      g: Math.round(30 + factor * 35),
      b: Math.round(60 + factor * 55),
    };

    return {
      bottomColor: `rgb(${bottom.r}, ${bottom.g}, ${bottom.b})`,
      topColor: `rgb(${top.r}, ${top.g}, ${top.b})`,
    };
  }

  /**
   * Get sunrise/sunset colors (-6° to 0°)
   */
  private getSunriseSunsetColors(sunElevation: number) {
    const factor = (sunElevation + 6) / 6; // 0 to 1
    const warmth = Math.sin(factor * Math.PI) * 0.8; // Warming effect

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

    return {
      bottomColor: `rgb(${bottom.r}, ${bottom.g}, ${bottom.b})`,
      topColor: `rgb(${top.r}, ${top.g}, ${top.b})`,
    };
  }

  /**
   * Calculate turbidity based on weather conditions
   * @param weatherCondition Weather condition
   * @param visibility Visibility in km (optional)
   * @returns Turbidity value (1.0 = very clear, 10.0 = very hazy)
   */
  calculateTurbidity(weatherCondition?: string, visibility?: number): number {
    if (visibility) {
      // Convert visibility to turbidity (rough approximation)
      return Math.max(1, Math.min(10, 15 / visibility));
    }

    const condition = weatherCondition?.toLowerCase() || '';

    if (condition.includes('clear')) return 1.5;
    if (condition.includes('few clouds') || condition.includes('scattered'))
      return 2.0;
    if (condition.includes('broken clouds')) return 3.0;
    if (condition.includes('overcast')) return 4.0;
    if (condition.includes('haze') || condition.includes('mist')) return 6.0;
    if (condition.includes('fog')) return 8.0;
    if (condition.includes('dust') || condition.includes('sand')) return 9.0;

    return 2.5; // Default moderate turbidity
  }
}
