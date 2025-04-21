// Special key to represent planes with no callsign
const NO_CALLSIGN_KEY = '__NO_CALLSIGN__';

export function filterPlaneByPrefix(
  callsign: string,
  excluded: boolean,
  prefixes: string[],
  isMilitary: boolean = false
): boolean {
  // Never filter out military planes
  if (isMilitary) {
    return false;
  }

  // If exclusion is disabled, nothing should be filtered out
  if (!excluded) return false;

  // Check for empty callsigns with the special key
  if (!callsign || callsign.trim() === '') {
    return prefixes.includes(NO_CALLSIGN_KEY);
  }

  const upper = callsign.toUpperCase();
  return prefixes.some((prefix) => upper.startsWith(prefix)); // Return true if the plane matches a filtered prefix
}

export function extractAirlinePrefix(callsign: string): string {
  if (!callsign || callsign.trim() === '') return NO_CALLSIGN_KEY;
  return callsign.slice(0, 3).toUpperCase();
}
