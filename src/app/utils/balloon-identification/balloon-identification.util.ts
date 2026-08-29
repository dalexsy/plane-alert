/** Lighter-than-air: ADS-B category, ICAO type, model name, German D-O / D-L regs. */

const BALLOON_TYPES = new Set(['BALL', 'BLMP', 'SHIP']);

export function isBalloonCategory(category?: string): boolean {
  return (category || '').trim().toUpperCase().startsWith('B2');
}

export function isBalloonTypeCode(icaoType?: string): boolean {
  if (!icaoType) return false;
  return BALLOON_TYPES.has(icaoType.trim().toUpperCase().replace(/[-\s]/g, ''));
}

export function isBalloonByModel(model?: string): boolean {
  if (!model) return false;
  return /balloon|blimp|airship|aerostat|zeppelin/.test(model.toLowerCase());
}

/** German balloons D-Oxxx and airships D-Lxxx (hyphen/space optional). */
export function isBalloonByCallsign(callsign?: string): boolean {
  if (!callsign) return false;
  const n = callsign.trim().toUpperCase().replace(/[-\s]/g, '');
  return /^D[OL][A-Z0-9]{3}$/.test(n);
}

export function isBalloonAircraft(fields: {
  model?: string;
  icaoType?: string;
  category?: string;
  callsign?: string;
}): boolean {
  if (isBalloonTypeCode(fields.icaoType) || isBalloonByModel(fields.model)) return true;
  const type = (fields.icaoType || '').trim();
  if (type) return false;
  return isBalloonCategory(fields.category) || isBalloonByCallsign(fields.callsign);
}
