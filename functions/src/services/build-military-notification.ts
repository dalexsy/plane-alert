import type { AdsBPlane } from '@plane-alert/shared';
import {
  normalizeCallsign,
  getAircraftCountry,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  formatDistance,
  getCountryFlagEmoji,
  formatNotificationTitle,
  getAircraftTypeName,
} from '@plane-alert/shared';
import type { DeviceRegistration, Location } from '../types';
import { FRONTEND_BASE_URL } from '../constants';
import { isSpecialAircraft } from '../utils';
import { buildNotificationBody } from './notification-builder';
import type { FlightData } from './aeroapi-client';
import type { PendingNotification } from './notification-types';

export async function buildMilitaryPendingNotification(
  plane: AdsBPlane,
  data: DeviceRegistration,
  deviceLocation: Location,
  pushoverTargetDeviceName: string,
  flightDataMap: Map<string, FlightData>,
): Promise<PendingNotification> {
  const icao = plane.hex!.toUpperCase();
  const isMilitary = plane.mil === true || plane.dbFlags === 1;
  const distanceKm = haversineDistanceKm(
    deviceLocation.lat,
    deviceLocation.lon,
    plane.lat!,
    plane.lon!,
  );

  const bearing = computeBearing(
    deviceLocation.lat,
    deviceLocation.lon,
    plane.lat!,
    plane.lon!,
  );
  const direction = bearingToCardinal(bearing);
  const distance = formatDistance(
    distanceKm,
    data.distanceUnit === 'miles' ? 'miles' : 'km',
  );

  const rawCountry =
    (plane as { ctry?: string; countryCode?: string }).ctry ??
    (plane as { countryCode?: string }).countryCode;
  const countryResult = getAircraftCountry(
    plane.r,
    plane.hex,
    rawCountry,
    isMilitary,
  );

  const countryCode =
    countryResult.countryCode !== 'Unknown'
      ? countryResult.countryCode
      : null;
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

  const icaoUpper = plane.hex.toUpperCase();
  const callsign = normalizeCallsign(plane.flight || plane.callsign);
  const model =
    plane.desc || (plane.t ? getAircraftTypeName(plane.t) : plane.t);

  const flightData = callsign
    ? flightDataMap.get(callsign.toUpperCase())
    : undefined;

  const skipCallsignInBody = !model;
  const body = await buildNotificationBody(
    plane,
    distance,
    direction,
    bearing,
    data.distanceUnit === 'miles' ? 'miles' : 'km',
    skipCallsignInBody,
    flightData,
  );

  let title = formatNotificationTitle(
    flagEmoji,
    model,
    callsign,
    icaoUpper,
  );

  if (model) {
    const modelUpper = model.toUpperCase();
    if (modelUpper.includes('A400') || modelUpper.includes('A-400')) {
      title = '🦜 ' + title;
    } else if (
      modelUpper.includes('E-3') ||
      modelUpper.includes('SENTRY')
    ) {
      title = '🛸 ' + title;
    }
  }

  const iconPath = isSpecialAircraft(icaoUpper)
    ? 'favicon/special'
    : 'favicon/military';
  const iconUrl = `${FRONTEND_BASE_URL}/assets/${iconPath}/android-chrome-192x192.png?v=${Date.now()}`;

  return {
    icao,
    deviceName: pushoverTargetDeviceName,
    location: {
      lat: deviceLocation.lat,
      lon: deviceLocation.lon,
      ...(deviceLocation.address && { address: deviceLocation.address }),
    },
    message: {
      title: title,
      message: body,
      url: `${FRONTEND_BASE_URL}/?lat=${plane.lat}&lon=${plane.lon}&zoom=12`,
      url_title: 'View Location',
      icon: iconUrl,
      model: plane.t || plane.desc,
      operator: plane.desc,
      registration: plane.r,
      hex: plane.hex,
    },
    ...(callsign && { callsign }),
    ...(model && { model }),
    ...(countryCode && { countryCode }),
    ...(plane.r && { registration: plane.r }),
    ...(plane.lat != null && { lat: plane.lat }),
    ...(plane.lon != null && { lon: plane.lon }),
    ...(typeof plane.alt_baro === 'number' && { altitude: plane.alt_baro }),
    ...(bearing != null && { bearing }),
    ...(direction && { cardinal: direction }),
  };
}
