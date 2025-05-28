/**
 * Debugging utilities for investigating why planes don't have trails
 */

export interface PlaneTrailDebugInfo {
  icao: string;
  callsign: string;
  isMilitary: boolean;
  isGrounded: boolean;
  altitude: number | null;
  velocity: number | null;
  positionHistoryLength: number;
  hasTrailSegments: boolean;
  trailSegmentCount: number;
  groundedReason: 'api' | 'heuristic' | 'none';
  debugSummary: string;
}

export function debugPlaneTrails(plane: any): PlaneTrailDebugInfo {
  const altitude = plane.altitude;
  const velocity = plane.velocity;
  const isGrounded = plane.onGround;

  // Determine why plane is grounded
  let groundedReason: 'api' | 'heuristic' | 'none' = 'none';
  if (isGrounded) {
    // Check if it would be grounded by heuristic
    const wouldBeGroundedByHeuristic =
      typeof altitude === 'number' &&
      altitude < 150 * 0.3048 && // Convert 150ft to meters
      typeof velocity === 'number' &&
      velocity < 50;

    groundedReason = wouldBeGroundedByHeuristic ? 'heuristic' : 'api';
  }

  const positionHistoryLength = plane.positionHistory?.length || 0;
  const hasTrailSegments = Array.isArray(plane.historyTrailSegments);
  const trailSegmentCount = hasTrailSegments
    ? plane.historyTrailSegments.length
    : 0;

  let debugSummary = '';

  if (!plane.isMilitary) {
    debugSummary = 'Not a military plane';
  } else if (positionHistoryLength <= 1) {
    debugSummary = `Insufficient position history (${positionHistoryLength} points, need >1)`;
  } else if (isGrounded) {
    const altText = altitude ? `${Math.round(altitude)}m` : 'unknown';
    const velText = velocity ? `${Math.round(velocity)}kts` : 'unknown';
    debugSummary = `Grounded (${groundedReason}): alt=${altText}, vel=${velText}`;
  } else if (trailSegmentCount === 0) {
    debugSummary =
      'Should have trails but none rendered - possible rendering issue';
  } else {
    debugSummary = `Has trails (${trailSegmentCount} segments)`;
  }

  return {
    icao: plane.icao,
    callsign: plane.callsign,
    isMilitary: plane.isMilitary,
    isGrounded,
    altitude,
    velocity,
    positionHistoryLength,
    hasTrailSegments,
    trailSegmentCount,
    groundedReason,
    debugSummary,
  };
}

/**
 * Debug all military planes and their trail status
 */
export function debugAllMilitaryPlanes(
  planeMap: Map<string, any>
): PlaneTrailDebugInfo[] {
  const militaryPlanes: PlaneTrailDebugInfo[] = [];

  for (const [icao, plane] of planeMap.entries()) {
    if (plane.isMilitary) {
      militaryPlanes.push(debugPlaneTrails(plane));
    }
  }

  return militaryPlanes.sort((a, b) => a.icao.localeCompare(b.icao));
}

/**
 * Console log debug info for a specific plane
 */
export function logPlaneDebugInfo(plane: any): void {
  const debug = debugPlaneTrails(plane);

  console.group(`🛩️ Plane Debug: ${debug.icao} (${debug.callsign})`);
  console.log(`Military: ${debug.isMilitary}`);
  console.log(`Grounded: ${debug.isGrounded} (${debug.groundedReason})`);
  console.log(
    `Altitude: ${debug.altitude ? Math.round(debug.altitude) + 'm' : 'unknown'}`
  );
  console.log(
    `Velocity: ${
      debug.velocity ? Math.round(debug.velocity) + 'kts' : 'unknown'
    }`
  );
  console.log(`Position History: ${debug.positionHistoryLength} points`);
  console.log(`Trail Segments: ${debug.trailSegmentCount}`);
  console.log(`Summary: ${debug.debugSummary}`);

  if (debug.positionHistoryLength > 1) {
    console.log('Recent positions:', plane.positionHistory?.slice(-3));
  }

  console.groupEnd();
}

// Add to window for browser console debugging
declare global {
  interface Window {
    debugPlaneTrails: typeof debugPlaneTrails;
    debugAllMilitaryPlanes: typeof debugAllMilitaryPlanes;
    logPlaneDebugInfo: typeof logPlaneDebugInfo;
  }
}

if (typeof window !== 'undefined') {
  window.debugPlaneTrails = debugPlaneTrails;
  window.debugAllMilitaryPlanes = debugAllMilitaryPlanes;
  window.logPlaneDebugInfo = logPlaneDebugInfo;
}
