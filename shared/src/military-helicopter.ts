/**
 * Helicopter signals for the military alert gate (ADS-B category, type, callsign).
 * Model-less military helis (rescue / RESQ) are treated as boring.
 */

import type { AdsBPlane } from './types';

function normalizeCallsignLocal(value?: string | null): string {
  if (!value) return '';
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/** ADS-B emitter category A7 = rotorcraft. */
export function isHelicopterCategory(category?: string): boolean {
  return (category || '').trim().toUpperCase() === 'A7';
}

/** ICAO type designators that are rotorcraft. */
export function isHelicopterTypeCode(icaoType?: string): boolean {
  if (!icaoType) return false;
  const t = icaoType.trim().toUpperCase().replace(/[-\s]/g, '');
  if (!t) return false;
  if (/^(EC|AS|BK)(\d{2}|\d{3})$/.test(t)) return true;
  if (/^(H1[2-7]\d|UH\d{2}|AH\d{2}|CH\d{2}|NH\d{2}|TIGR|S76|S92|R22|R44|R66)$/.test(t)) {
    return true;
  }
  const known = new Set([
    'A109', 'A119', 'A139', 'A149', 'A169', 'A189', 'B06', 'B206', 'B212', 'B407',
    'B412', 'B429', 'EC35', 'EC45', 'EC55', 'H145', 'H135', 'H125', 'H160', 'H175',
    'EC25', 'AS32', 'AS3B', 'CH47', 'UH60', 'AH64', 'CH53', 'NH90',
  ]);
  return known.has(t);
}

/** Callsigns that are almost always rotorcraft (incl. German SAR RESQ). */
export function isHelicopterCallsign(callsign?: string): boolean {
  if (!callsign) return false;
  const normalized = normalizeCallsignLocal(callsign);
  if (!normalized) return false;
  const patterns = [
    /^(JOKER|TIGER|VIPER|COBRA|APACHE)\d+$/,
    /^(RESCUE|RESQ|MEDIC|LIFEGUARD|HEMS|HELIMED)\d*$/,
    /^(POLICE|POLIZEI|POLAIR|POLIS)\d*$/,
    /^(CHX|ADAC|DRF|HTM)\d+$/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

/**
 * True when we have a real type code or a descriptive model name.
 * SPA placeholder "Helicopter" (set when rotorcraft is detected without a model)
 * does not count.
 */
export function hasMeaningfulAircraftModel(plane: AdsBPlane): boolean {
  const type = (plane.t || plane.type || '').trim();
  if (type) return true;
  const desc = (plane.desc || '').trim();
  if (!desc) return false;
  if (/^helicopter$/i.test(desc)) return false;
  return true;
}

export function isLikelyHelicopter(plane: AdsBPlane): boolean {
  if (isHelicopterCategory(plane.category)) return true;
  if (isHelicopterTypeCode(plane.t || plane.type)) return true;
  if (isHelicopterCallsign(plane.flight || plane.callsign)) return true;
  if (/^helicopter$/i.test((plane.desc || '').trim())) return true;
  return false;
}
