import { Injectable } from '@angular/core';
import SunCalc from 'suncalc';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';

@Injectable({ providedIn: 'root' })
export class CelestialService {
  /**
   * Compute Sun and Moon markers for window view overlay
   */
  getMarkers(lat: number, lon: number): WindowViewPlane[] {
    const now = new Date();
    const sunPos = SunCalc.getPosition(now, lat, lon);
    const moonPos = SunCalc.getMoonPosition(now, lat, lon);
    const moonIllum = SunCalc.getMoonIllumination(now);

    // Convert azimuth/altitude to x/y percentages
    const azToX = (az: number) => {
      let deg = (az * 180) / Math.PI;
      deg = (deg + 360) % 360;
      return (deg / 360) * 100;
    };
    const altToY = (alt: number) =>
      Math.max(0, Math.min(100, (alt / (Math.PI / 2)) * 100));

    const sunBelow = sunPos.altitude < 0;
    const sun: WindowViewPlane = {
      x: azToX(sunPos.azimuth),
      y: altToY(sunPos.altitude),
      callsign: 'Sun',
      icao: 'SUN',
      altitude: 0,
      origin: '', // Celestial body - no origin country
      isCelestial: true,
      celestialBodyType: 'sun',
      scale: 1,
      belowHorizon: sunBelow,
    };

    // Determine moon orientation toward Sun
    const moonToSunAz = sunPos.azimuth - moonPos.azimuth;
    const moonAngle = (moonToSunAz * 180) / Math.PI;
    const moon: WindowViewPlane = {
      x: azToX(moonPos.azimuth),
      y: altToY(moonPos.altitude),
      callsign: 'Moon',
      icao: 'MOON',
      altitude: 0,
      origin: '', // Celestial body - no origin country
      isCelestial: true,
      celestialBodyType: 'moon',
      scale: 1,
      moonPhase: moonIllum.phase,
      moonFraction: moonIllum.fraction,
      moonAngle: moonAngle,
      moonIsWaning: moonIllum.phase > 0.5,
      belowHorizon: moonPos.altitude < 0,
    };

    return [sun, moon];
  }
}
