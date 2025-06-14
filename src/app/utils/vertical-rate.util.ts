/**
 * Utility functions for calculating vertical rate (ascent/descent) for aircraft
 * Enterprise-ready implementation with fallback mechanisms
 */

import { PositionHistory } from '../models/plane-model';

/**
 * Calculate vertical rate from position history when API baro_rate is not available
 * Uses linear regression over recent position history for accurate rate calculation
 * 
 * @param positionHistory Array of historical positions with altitude data
 * @param timeWindowSeconds Time window to consider for calculation (default: 60 seconds)
 * @returns Vertical rate in m/s (positive = ascending, negative = descending), or null if insufficient data
 */
export function calculateVerticalRateFromHistory(
  positionHistory: PositionHistory[],
  timeWindowSeconds: number = 60
): number | null {
  if (!positionHistory || positionHistory.length < 2) {
    return null;
  }

  const now = Date.now();
  const timeWindow = timeWindowSeconds * 1000; // Convert to milliseconds
  
  // Filter to recent positions with valid altitude data
  const recentPositions = positionHistory
    .filter(pos => 
      pos.altitude != null && 
      pos.timestamp > (now - timeWindow)
    )
    .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp ascending

  if (recentPositions.length < 2) {
    return null;
  }

  // Use linear regression for more accurate rate calculation
  const n = recentPositions.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  recentPositions.forEach((pos, index) => {
    const x = (pos.timestamp - recentPositions[0].timestamp) / 1000; // Time in seconds from first point
    const y = pos.altitude!; // Altitude in meters
    
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  // Calculate slope (vertical rate) using least squares regression
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) {
    // Fallback to simple rate calculation if regression fails
    return calculateSimpleVerticalRate(recentPositions);
  }

  const slope = (n * sumXY - sumX * sumY) / denominator; // m/s
  
  // Clamp to reasonable aviation limits (-50 to +50 m/s)
  return Math.max(-50, Math.min(50, slope));
}

/**
 * Simple vertical rate calculation using first and last positions
 * Fallback method when regression calculation fails
 */
function calculateSimpleVerticalRate(positions: PositionHistory[]): number | null {
  if (positions.length < 2) return null;
  
  const first = positions[0];
  const last = positions[positions.length - 1];
  
  const altitudeDiff = last.altitude! - first.altitude!; // meters
  const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
  
  if (timeDiff <= 0) return null;
  
  const rate = altitudeDiff / timeDiff; // m/s
  
  // Clamp to reasonable limits
  return Math.max(-50, Math.min(50, rate));
}

/**
 * Calculate tilt angle for plane icon based on vertical rate
 * Maps vertical rate to visually appropriate tilt angles
 * 
 * @param verticalRate Vertical rate in m/s
 * @param maxTiltAngle Maximum tilt angle in degrees (default: 15°)
 * @param maxVerticalRate Maximum vertical rate for full tilt (default: 20 m/s)
 * @returns Tilt angle in degrees (positive = nose up, negative = nose down)
 */
export function calculateTiltAngle(
  verticalRate: number | null,
  maxTiltAngle: number = 15,
  maxVerticalRate: number = 20
): number {
  if (verticalRate === null || verticalRate === undefined) {
    return 0; // No tilt if no vertical rate data
  }

  // Clamp vertical rate to reasonable range
  const clampedRate = Math.max(-maxVerticalRate, Math.min(maxVerticalRate, verticalRate));
  
  // Calculate proportional tilt angle
  const tiltAngle = (clampedRate / maxVerticalRate) * maxTiltAngle;
  
  return Math.round(tiltAngle * 10) / 10; // Round to 1 decimal place for smooth animation
}

/**
 * Get vertical rate display text for UI components
 * 
 * @param verticalRate Vertical rate in m/s
 * @returns Formatted string for display
 */
export function formatVerticalRate(verticalRate: number | null): string {
  if (verticalRate === null || verticalRate === undefined) {
    return '';
  }
  
  const absRate = Math.abs(verticalRate);
  const direction = verticalRate >= 0 ? '↑' : '↓';
  
  if (absRate < 0.1) {
    return 'Level'; // Essentially level flight
  }
  
  return `${direction} ${absRate.toFixed(1)} m/s`;
}
