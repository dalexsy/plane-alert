import {
  planeFieldsToAdsB,
  shouldAlertForAircraft,
} from '@plane-alert/shared';

/** Shared gate → UI: muted green when military but not alert-worthy. */
export function isMilitaryAlertWorthy(fields: {
  icao: string;
  callsign?: string;
  model?: string;
  type?: string;
  isMilitary?: boolean;
  isSpecial?: boolean;
}): boolean {
  if (!fields.isMilitary && !fields.isSpecial) return false;
  return shouldAlertForAircraft(
    planeFieldsToAdsB({
      icao: fields.icao,
      callsign: fields.callsign,
      model: fields.model,
      type: fields.type,
      isMilitary: fields.isMilitary,
    }),
    { isSpecial: !!fields.isSpecial },
  );
}
