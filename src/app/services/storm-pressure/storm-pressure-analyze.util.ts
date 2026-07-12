import type { StormPressureAnalysis } from './storm-pressure.service';

export const STORM_PRESSURE_THRESHOLDS = {
  NORMAL_SEA_LEVEL: 1013.25,
  STORM: 995,
  SEVERE: 980,
};

export function calculateConfidence(
  pressure: number,
  pressureDrop: number,
  temperature?: number,
  humidity?: number,
  windSpeed?: number,
): number {
  let confidence = Math.min(0.6, pressureDrop / 30);

  if (temperature !== undefined) {
    const tempFactor = Math.max(0, (25 - temperature) / 25);
    confidence += tempFactor * 0.15;
  }

  if (humidity !== undefined && humidity > 70) {
    confidence += Math.min(0.15, ((humidity - 70) / 30) * 0.15);
  }

  if (windSpeed !== undefined && windSpeed > 5) {
    confidence += Math.min(0.1, ((windSpeed - 5) / 15) * 0.1);
  }

  return Math.min(1, confidence);
}

export function calculatePressureTrend(
  pressureHistory: Array<{ pressure: number; timestamp: number }>,
): number {
  if (pressureHistory.length < 2) {
    return 0;
  }

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recentReadings = pressureHistory.filter(
    (entry) => entry.timestamp > oneHourAgo,
  );

  if (recentReadings.length < 2) {
    return 0;
  }

  const oldest = recentReadings[0];
  const newest = recentReadings[recentReadings.length - 1];
  const timeDiff = newest.timestamp - oldest.timestamp;
  const pressureDiff = newest.pressure - oldest.pressure;

  return (pressureDiff / timeDiff) * (60 * 60 * 1000);
}

export function analyzeStormPressure(
  currentPressure: number,
  pressureHistory: Array<{ pressure: number; timestamp: number }>,
  temperature?: number,
  humidity?: number,
  windSpeed?: number,
): StormPressureAnalysis {
  const { NORMAL_SEA_LEVEL, STORM, SEVERE } = STORM_PRESSURE_THRESHOLDS;
  const normalPressure = NORMAL_SEA_LEVEL;
  const pressureDrop = normalPressure - currentPressure;
  const maxDrop = normalPressure - SEVERE;
  const dropIntensity = Math.max(0, Math.min(1, pressureDrop / maxDrop));
  const isStormApproaching = currentPressure < STORM;

  let stormSeverity: StormPressureAnalysis['stormSeverity'] = 'none';
  if (currentPressure < SEVERE) {
    stormSeverity = 'severe';
  } else if (currentPressure < 990) {
    stormSeverity = 'moderate';
  } else if (currentPressure < STORM) {
    stormSeverity = 'mild';
  }

  let confidence = calculateConfidence(
    currentPressure,
    pressureDrop,
    temperature,
    humidity,
    windSpeed,
  );

  const pressureTrend = calculatePressureTrend(pressureHistory);
  if (pressureTrend < -2) {
    confidence = Math.min(1, confidence + 0.3);
  }

  return {
    currentPressure,
    normalPressure,
    dropIntensity,
    isStormApproaching: isStormApproaching && dropIntensity > 0.2,
    stormSeverity,
    confidence,
  };
}

export function describeStormPressure(
  analysis: StormPressureAnalysis,
): string {
  if (analysis.stormSeverity === 'severe') {
    return 'Severe low pressure - major storm conditions';
  }
  if (analysis.stormSeverity === 'moderate') {
    return 'Moderate low pressure - storm likely';
  }
  if (analysis.stormSeverity === 'mild') {
    return 'Low pressure - unsettled weather';
  }
  if (analysis.currentPressure > 1020) {
    return 'High pressure - clear weather likely';
  }
  return 'Normal pressure conditions';
}
