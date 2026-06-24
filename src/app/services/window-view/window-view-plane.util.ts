import type { DimSegment } from '../../components/window-view-overlay/dim-overlay/dim-overlay.component';
import type { AltitudeTick } from '../../components/window-view-overlay/altitude-bands/altitude-bands.component';
import type { CelestialService } from '../celestial.service';
import type { AltitudeColorService } from '../altitude-color.service';
import type { WindowViewPlane } from '../../types/window-view-plane';

export function computeDimSegments(
  planes: WindowViewPlane[],
  isAtHome: boolean
): DimSegment[] {
  if (!isAtHome) {
    return [];
  }
  const markers = planes.filter((p) => p.isMarker);
  const bStart = markers.find(
    (p) => p.callsign.startsWith('Balcony') && p.callsign.endsWith('Start')
  );
  const bEnd = markers.find(
    (p) => p.callsign.startsWith('Balcony') && p.callsign.endsWith('End')
  );
  const sStart = markers.find(
    (p) => p.callsign.startsWith('Streetside') && p.callsign.endsWith('Start')
  );
  const sEnd = markers.find(
    (p) => p.callsign.startsWith('Streetside') && p.callsign.endsWith('End')
  );
  if (
    bStart?.x == null ||
    bEnd?.x == null ||
    sStart?.x == null ||
    sEnd?.x == null
  ) {
    return [];
  }
  const bS = bStart.x;
  const bE = bEnd.x;
  const sS = sStart.x;
  const sE = sEnd.x;
  const seg1Left = bE % 100;
  const seg1Width = (sS - bE + 100) % 100 || 0;
  const seg2Left = sE % 100;
  const seg2Width = (bS - sE + 100) % 100 || 0;
  return [
    { left: seg1Left, width: seg1Width },
    { left: seg2Left, width: seg2Width },
  ];
}

export function assignGroundStackOrder(planes: WindowViewPlane[]): void {
  let order = 0;
  for (const p of planes) {
    if (p.isGrounded) {
      p.groundStackOrder = order++;
    } else {
      p.groundStackOrder = undefined;
    }
  }
}

export function getMovementDirection(
  plane: WindowViewPlane,
  prevXPositions: Map<string, number>,
  lastKnownDirections: Map<string, 'left' | 'right'>
): 'left' | 'right' | null {
  if (plane.historyTrail && plane.historyTrail.length >= 2) {
    const current = plane.historyTrail[plane.historyTrail.length - 1];
    const previous = plane.historyTrail[plane.historyTrail.length - 2];
    let deltaX = current.x - previous.x;
    if (deltaX > 50) {
      deltaX -= 100;
    } else if (deltaX < -50) {
      deltaX += 100;
    }
    if (Math.abs(deltaX) > 0.05) {
      const direction = deltaX > 0 ? 'right' : 'left';
      lastKnownDirections.set(plane.icao, direction);
      return direction;
    }
  }
  const prevX = prevXPositions.get(plane.icao);
  if (prevX !== undefined) {
    let deltaX = plane.x - prevX;
    if (deltaX > 50) {
      deltaX -= 100;
    } else if (deltaX < -50) {
      deltaX += 100;
    }
    if (Math.abs(deltaX) > 0.05) {
      const direction = deltaX > 0 ? 'right' : 'left';
      lastKnownDirections.set(plane.icao, direction);
      return direction;
    }
  }
  return lastKnownDirections.get(plane.icao) || 'right';
}

export function filterMarkerPlanes(
  planes: WindowViewPlane[],
  isAtHome: boolean
): WindowViewPlane[] {
  let markerPlanes = planes.filter((plane) => plane.isMarker);
  if (!isAtHome) {
    markerPlanes = markerPlanes.filter(
      (plane) =>
        !plane.callsign.startsWith('Balcony') &&
        !plane.callsign.startsWith('Streetside')
    );
  }
  return markerPlanes;
}

export function getSunObject(
  planes: WindowViewPlane[]
): WindowViewPlane | undefined {
  return planes.find(
    (p) => p.isCelestial === true && p.celestialBodyType === 'sun'
  );
}

export function isDaytime(planes: WindowViewPlane[]): boolean {
  const sun = getSunObject(planes);
  const sunElevation = sun ? (sun.y / 100) * 90 : -90;
  return !!(sun && !sun.belowHorizon && sunElevation > 0);
}

export function getSunElevationAngle(planes: WindowViewPlane[]): number {
  const sun = getSunObject(planes);
  if (sun && !sun.belowHorizon) {
    return (sun.y / 100) * 90;
  }
  return sun ? -10 : -20;
}

export function getSunGradientBottomPosition(planes: WindowViewPlane[]): string {
  const sun = getSunObject(planes);
  if (!sun) {
    return '0%';
  }
  const basePosition = `calc(${sun.y}% - 0.5rem)`;
  return `min(${basePosition}, calc(100% - 7.5rem))`;
}

export function injectCelestialMarkers(
  planes: WindowViewPlane[],
  observerLat: number,
  observerLon: number,
  celestial: CelestialService
): WindowViewPlane[] {
  if (!Number.isFinite(observerLat) || !Number.isFinite(observerLon)) {
    return planes;
  }
  const markers = celestial.getMarkers(observerLat, observerLon);
  return [...planes.filter((p) => !p.isCelestial), ...markers];
}

export function computeAltitudeTicks(
  viewMaxAltitude: number,
  altitudeColor: AltitudeColorService
): AltitudeTick[] {
  const tickIncrement = 2000;
  const values: number[] = [];
  for (let alt = 0; alt <= viewMaxAltitude; alt += tickIncrement) {
    values.push(alt);
  }
  return values.map((tick) => {
    const y = (tick / viewMaxAltitude) * 100;
    const label = tick === 0 ? '0' : tick / 1000 + 'km';
    const color = altitudeColor.getFillColor(tick);
    const fillColor = color.replace('hsl(', 'hsla(').replace(')', ', 0.05)');
    return { y, label, color, fillColor };
  });
}

export function applyAnimationTiming(
  el: HTMLElement,
  scanInterval: number,
  animationsEnabled: boolean
): void {
  const animationDuration = animationsEnabled ? scanInterval * 0.95 : 0;
  el.style.setProperty('--plane-animation-duration', `${animationDuration}s`);
  el.style.setProperty('--celestial-animation-duration', `${animationDuration}s`);
  el.style.setProperty('--trail-animation-duration', `${animationDuration}s`);
  el.style.setProperty('will-change', 'auto');
  el.style.setProperty('backface-visibility', 'hidden');
}
