import type { WindowViewPlane } from '../../types/window-view-plane';

function trailDeltaFromHistory(plane: WindowViewPlane): { dx: number; dy: number } | null {
  const current = { x: plane.x, y: plane.y };
  if (!(current.y > 0.1 && current.x >= 0 && current.x <= 100)) return null;
  if (!plane.historyTrail?.length) return null;

  let previous: { x: number; y: number } | null = null;
  for (let i = plane.historyTrail.length - 1; i >= 0; i--) {
    const candidate = plane.historyTrail[i];
    if (!(candidate.y > 0.1 && candidate.x >= 0 && candidate.x <= 100)) {
      continue;
    }
    let deltaX = current.x - candidate.x;
    let deltaY = current.y - candidate.y;
    if (deltaX > 50) deltaX -= 100;
    else if (deltaX < -50) deltaX += 100;
    if (Math.abs(deltaX) <= 0.05 && Math.abs(deltaY) <= 0.05) {
      continue;
    }
    previous = candidate;
    break;
  }
  if (!previous) return null;

  let deltaX = current.x - previous.x;
  let deltaY = current.y - previous.y;
  if (deltaX > 50) deltaX -= 100;
  else if (deltaX < -50) deltaX += 100;
  if (Math.abs(deltaX) <= 0.05 && Math.abs(deltaY) <= 0.05) return null;
  return { dx: deltaX, dy: deltaY };
}

function applyPerspectiveCorrection(
  movementAngle: number,
  planeX: number,
  planeY: number
): number {
  const altitudeFactor = Math.max(0, Math.min(1, planeY / 50));
  const perspectiveStrength = (1 - altitudeFactor) * 0.15;
  const azimuth = (planeX * 3.6) % 360;
  let vanishingPointAngle: number;
  if (azimuth < 45 || azimuth > 315) vanishingPointAngle = 0;
  else if (azimuth >= 45 && azimuth < 135) vanishingPointAngle = 90;
  else if (azimuth >= 135 && azimuth < 225) vanishingPointAngle = 180;
  else vanishingPointAngle = 270;
  const corrected =
    movementAngle * (1 - perspectiveStrength) +
    vanishingPointAngle * perspectiveStrength;
  return ((corrected % 360) + 360) % 360;
}

export function getPerspectiveTransform(plane: WindowViewPlane): string {
  if (plane.isGrounded) {
    return 'perspective(300px) rotateX(60deg) rotateY(-0deg) rotateZ(90deg)';
  }
  const maxAltitude = 20000;
  const altitude = Math.max(plane.altitude || 1000, 100);
  const clamped = Math.min(altitude, maxAltitude);
  const minTilt = 10;
  const maxTilt = 60;
  const tilt =
    minTilt + ((clamped - 100) / (maxAltitude - 100)) * (maxTilt - minTilt);
  const distanceFromCenter = Math.abs(plane.x - 50) / 50;
  const totalTilt = tilt + distanceFromCenter * 10;
  return `perspective(400px) rotateX(${totalTilt}deg)`;
}

export function getIconRotation(plane: WindowViewPlane): string {
  if (plane.iconType === 'balloon' || plane.isHelicopter) {
    return 'rotateZ(0deg)';
  }
  const delta = trailDeltaFromHistory(plane);
  if (delta) {
    let movementAngle = Math.atan2(-delta.dy, delta.dx) * (180 / Math.PI);
    movementAngle = ((movementAngle % 360) + 360) % 360;
    const iconRotation = (movementAngle + 90) % 360;
    return `rotateZ(${iconRotation.toFixed(1)}deg)`;
  }
  if (plane.movementDirection) {
    const rotationMap: Record<string, number> = {
      left: 270,
      right: 90,
      up: 0,
      down: 180,
    };
    return `rotateZ(${rotationMap[plane.movementDirection] || 0}deg)`;
  }
  return 'rotateZ(0deg)';
}

function getPerspectiveTrailRotation(plane: WindowViewPlane): string {
  const delta = trailDeltaFromHistory(plane);
  if (delta) {
    let movementAngle = Math.atan2(-delta.dy, delta.dx) * (180 / Math.PI);
    movementAngle = ((movementAngle % 360) + 360) % 360;
    const perspectiveAngle = applyPerspectiveCorrection(
      movementAngle,
      plane.x,
      plane.y
    );
    return `rotate(${((perspectiveAngle + 180) % 360).toFixed(1)}deg)`;
  }
  if (plane.bearing != null) {
    const bearingAngle = (90 - plane.bearing + 360) % 360;
    const perspectiveAngle = applyPerspectiveCorrection(
      bearingAngle,
      plane.x,
      plane.y
    );
    return `rotate(${((perspectiveAngle + 180) % 360).toFixed(1)}deg)`;
  }
  return 'rotate(180deg)';
}

function skipsAircraftFx(plane: WindowViewPlane): boolean {
  return !!(
    plane.isMarker ||
    plane.isHelicopter ||
    plane.isGrounded ||
    plane.isCelestial ||
    plane.iconType === 'balloon'
  );
}

export function getChemtrailRotation(plane: WindowViewPlane): string {
  if (skipsAircraftFx(plane)) return '';
  if (!plane.altitude || plane.altitude < 8000) return '';
  return getPerspectiveTrailRotation(plane);
}

export function getChemtrailScale(plane: WindowViewPlane): number {
  if (skipsAircraftFx(plane)) return 0;
  if (!plane.altitude || plane.altitude < 8000) return 0;
  if (!plane.velocity || plane.velocity <= 0) return 1;
  const minVelocity = 50;
  const maxVelocity = 600;
  const clamped = Math.max(minVelocity, Math.min(maxVelocity, plane.velocity));
  const normalized = (clamped - minVelocity) / (maxVelocity - minVelocity);
  return Math.round((0.1 + normalized * 0.9) * 100) / 100;
}

export function get3DDepthTransform(plane: WindowViewPlane): string {
  if (plane.isMarker || plane.isCelestial) return 'translateZ(0px)';
  const maxAltitude = 20000;
  const maxDistance = 100;
  const altNorm = Math.min((plane.altitude || 0) / maxAltitude, 1);
  const distNorm = Math.min((plane.distanceKm || 0) / maxDistance, 1);
  const combined = altNorm * 0.7 + distNorm * 0.3;
  const depthPx = -combined * 500;
  if (plane.isGrounded) return 'translateZ(-10px)';
  if (plane.distanceKm != null && plane.distanceKm <= 10) {
    return `translateZ(${Math.max(depthPx * 0.3, -100)}px)`;
  }
  return `translateZ(${depthPx}px)`;
}

export function getAtmosphericPerspective(plane: WindowViewPlane): number {
  if (plane.isMarker || plane.isCelestial) return 1;
  const distanceFactor = Math.min((plane.distanceKm || 0) / 70, 1);
  const altitudeFactor = Math.min((plane.altitude || 0) / 20000, 1);
  const intensity = distanceFactor * 0.8 + altitudeFactor * 0.2;
  return Math.max(0.1, 1 - intensity * 0.7);
}

export function planeBottomStyle(plane: WindowViewPlane): string {
  if (plane.isGrounded) {
    return `calc(${plane.groundStackOrder! * 2.25}rem - 1rem)`;
  }
  return `calc(${plane.y}% - .5rem)`;
}

export function planeScalePrefix(plane: WindowViewPlane): string {
  if (plane.isGrounded || plane.isMarker || plane.isCelestial) return '';
  return `scale(${plane.scale || 1}) `;
}
