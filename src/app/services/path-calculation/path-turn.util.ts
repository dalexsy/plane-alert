import { PositionHistory } from '../../models/plane-model';

export function calculateTurnRate(
  positionHistory: PositionHistory[],
  currentTrack: number
): { turnRatePerMin: number } {
  if (positionHistory.length < 3) return { turnRatePerMin: 0 };
  const recentTracks: { track: number; timestamp: number }[] = [];
  for (let i = Math.max(0, positionHistory.length - 5); i < positionHistory.length; i++) {
    if (positionHistory[i].track != null) {
      recentTracks.push({ track: positionHistory[i].track!, timestamp: positionHistory[i].timestamp });
    }
  }
  if (currentTrack != null) recentTracks.push({ track: currentTrack, timestamp: Date.now() });
  if (recentTracks.length < 3) return { turnRatePerMin: 0 };
  let totalTurnRate = 0;
  let validPairs = 0;
  for (let i = 1; i < recentTracks.length; i++) {
    const dtMin = (recentTracks[i].timestamp - recentTracks[i - 1].timestamp) / 60000;
    if (dtMin >= 0.1 && dtMin <= 5) {
      const rawDelta = ((recentTracks[i].track - recentTracks[i - 1].track + 540) % 360) - 180;
      const turnRate = rawDelta / dtMin;
      if (Math.abs(turnRate) <= 10) {
        totalTurnRate += turnRate;
        validPairs++;
      }
    }
  }
  return { turnRatePerMin: validPairs > 0 ? totalTurnRate / validPairs : 0 };
}
