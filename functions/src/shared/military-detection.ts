import type { AdsBPlane } from './types';
import {
  BORING_AIRCRAFT_TYPES,
  MIL_CALLSIGN_PREFIXES,
  MIL_OPERATOR_KEYWORDS,
} from './military-detection-lists';

export {
  BORING_AIRCRAFT_TYPES,
  MIL_CALLSIGN_PREFIXES,
  MIL_OPERATOR_KEYWORDS,
} from './military-detection-lists';

export function normalizeCallsign(value?: string | null): string {
  if (!value) {
    return '';
  }
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export function looksMilitary(plane: AdsBPlane): boolean {
  if (!(plane.mil === true || plane.dbFlags === 1)) {
    return false;
  }

  const aircraftType = plane.t || plane.type || '';
  const normalizedType = aircraftType.toUpperCase().replace(/[-\s]/g, '');

  if (BORING_AIRCRAFT_TYPES.some((boring) => normalizedType.includes(boring))) {
    return false;
  }

  return true;
}

export function isMilitaryCallsign(callsign?: string): boolean {
  if (!callsign) {
    return false;
  }

  const normalized = normalizeCallsign(callsign);

  return MIL_CALLSIGN_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase()),
  );
}

export function isMilitaryOperator(operatorName?: string): boolean {
  if (!operatorName) {
    return false;
  }

  const lowerName = operatorName.toLowerCase();

  return MIL_OPERATOR_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}
