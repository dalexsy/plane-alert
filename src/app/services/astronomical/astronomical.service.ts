import { Injectable } from '@angular/core';
import SunCalc from 'suncalc';

export interface AstronomicalData {
  sunAngle: number;
  isNight: boolean;
  sunEventText: string;
  moonFraction: number;
  moonIsWaning: boolean;
  moonPhaseName: string;
  moonTerminatorAngle: number;
}

@Injectable({
  providedIn: 'root',
})
export class AstronomicalService {
  /**
   * Calculate astronomical data for the given location and time
   */
  calculateAstronomicalData(
    lat: number,
    lon: number,
    currentTime: Date = new Date()
  ): AstronomicalData {
    // Calculate sun position using SunCalc
    const sunPos = SunCalc.getPosition(currentTime, lat, lon);
    const moonPos = SunCalc.getMoonPosition(currentTime, lat, lon);
    const moonIllum = SunCalc.getMoonIllumination(currentTime);

    // Convert azimuth from radians to degrees (0° = North, 90° = East)
    const sunAzimuthDeg = (sunPos.azimuth * 180) / Math.PI;
    const sunAngle = (sunAzimuthDeg + 180) % 360; // Adjust for display

    // Check if it's night (sun below horizon)
    const isNight = sunPos.altitude < 0;

    // Calculate next sun event
    const sunTimes = SunCalc.getTimes(currentTime, lat, lon);
    const currentTimeMs = currentTime.getTime();

    let sunEventText: string;
    if (isNight) {
      // If it's night, find the next sunrise (today or tomorrow)
      let sunriseDate = sunTimes.sunrise;
      if (sunriseDate.getTime() <= currentTimeMs) {
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        sunriseDate = SunCalc.getTimes(tomorrow, lat, lon).sunrise;
      }
      const sunrise = sunriseDate.getTime();
      const timeUntilSunrise = Math.max(0, sunrise - currentTimeMs);
      const hoursUntilSunrise = Math.floor(timeUntilSunrise / (1000 * 60 * 60));
      const minutesUntilSunrise = Math.floor(
        (timeUntilSunrise % (1000 * 60 * 60)) / (1000 * 60)
      );
      sunEventText = `Sunrise ${hoursUntilSunrise}h ${minutesUntilSunrise}m`;
    } else {
      // If it's day, show time until sunset
      const sunset = sunTimes.sunset.getTime();
      const timeUntilSunset = Math.max(0, sunset - currentTimeMs);
      const hoursUntilSunset = Math.floor(timeUntilSunset / (1000 * 60 * 60));
      const minutesUntilSunset = Math.floor(
        (timeUntilSunset % (1000 * 60 * 60)) / (1000 * 60)
      );
      sunEventText = `Sunset ${hoursUntilSunset}h ${minutesUntilSunset}m`;
    }

    // Update moon properties for night display
    const moonFraction = moonIllum.fraction;
    const moonIsWaning = moonIllum.phase > 0.5;

    // Calculate moon phase name
    const phase = moonIllum.phase;
    let moonPhaseName: string;
    if (phase < 0.1 || phase > 0.9) {
      moonPhaseName = 'New Moon';
    } else if (phase < 0.3) {
      moonPhaseName = 'Waxing Crescent';
    } else if (phase < 0.4) {
      moonPhaseName = 'First Quarter';
    } else if (phase < 0.6) {
      moonPhaseName = 'Waxing Gibbous';
    } else if (phase < 0.7) {
      moonPhaseName = 'Full Moon';
    } else if (phase < 0.9) {
      moonPhaseName = 'Waning Gibbous';
    } else {
      moonPhaseName = 'Last Quarter';
    }

    // Store terminator tilt (phase angle) for mask rotation
    const moonTerminatorAngle = (moonIllum.angle * 180) / Math.PI;

    return {
      sunAngle,
      isNight,
      sunEventText,
      moonFraction,
      moonIsWaning,
      moonPhaseName,
      moonTerminatorAngle,
    };
  }

  /**
   * Get the background color for the moon (dark side)
   */
  getMoonBackgroundColor(): string {
    return '#000000';
  }

  /**
   * Get the lit color for the moon (illuminated side)
   */
  getMoonLitColor(): string {
    return '#d4d4d4';
  }

  /**
   * Calculate azimuth (bearing) from one point to another
   */
  calculateAzimuth(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
  ): number {
    const dLon = ((toLon - fromLon) * Math.PI) / 180;
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  }
}
