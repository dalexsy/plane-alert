import { isBoringMilitaryAircraft } from '@plane-alert/shared';
import type { AdsBPlane } from '@plane-alert/shared';

/** Fields needed to run the shared Pushover boring gate on SPA planes. */
export interface BoringAlertPlane {
  icao: string;
  callsign?: string;
  model?: string;
  isMilitary?: boolean;
  isSpecial?: boolean;
}

/**
 * Map SPA plane fields onto AdsBPlane so audio uses the same boring filter
 * as Pushover (`isBoringMilitaryAircraft` in shared).
 */
export function toAdsBForBoringCheck(plane: BoringAlertPlane): AdsBPlane {
  const mil = plane.isMilitary === true;
  return {
    hex: plane.icao,
    flight: plane.callsign,
    callsign: plane.callsign,
    desc: plane.model,
    mil,
    dbFlags: mil ? 1 : undefined,
  };
}

/** True when this plane should trigger SPA MP3/TTS (matches Pushover interestingness). */
export function shouldPlayMilitaryAudio(plane: BoringAlertPlane): boolean {
  if (plane.isSpecial) return true;
  if (!plane.isMilitary) return false;
  return !isBoringMilitaryAircraft(toAdsBForBoringCheck(plane));
}
