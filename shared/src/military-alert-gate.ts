import type { AdsBPlane } from './types';
import {
  isBoringMilitaryAircraft,
  isMilitaryCallsign,
  looksMilitary,
} from './military-detection';

export type AlertAircraftOptions = {
  /** User/special-list ICAO — always alerts, even if boring. */
  isSpecial?: boolean;
};

/**
 * Single alert gate for Pushover and audio (kiosk PipeWire, SPA MP3/TTS).
 * Special always alerts. Otherwise: military candidate and not boring.
 */
export function shouldAlertForAircraft(
  plane: AdsBPlane,
  options?: AlertAircraftOptions,
): boolean {
  if (options?.isSpecial) {
    return true;
  }

  const callsign = plane.flight || plane.callsign;
  const isMilitaryCandidate =
    looksMilitary(plane) ||
    isMilitaryCallsign(callsign) ||
    plane.mil === true ||
    plane.dbFlags === 1;

  if (!isMilitaryCandidate) {
    return false;
  }

  return !isBoringMilitaryAircraft(plane);
}

/** SPA plane fields → AdsBPlane so the shared gate runs without a second filter. */
export function planeFieldsToAdsB(fields: {
  icao: string;
  callsign?: string;
  model?: string;
  type?: string;
  isMilitary?: boolean;
}): AdsBPlane {
  const mil = fields.isMilitary === true;
  return {
    hex: fields.icao,
    flight: fields.callsign,
    callsign: fields.callsign,
    desc: fields.model,
    t: fields.type,
    mil: mil || undefined,
    dbFlags: mil ? 1 : undefined,
  };
}
