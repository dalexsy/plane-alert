import SunCalc from 'suncalc';

export function computePlaneShadowStyle(
  lat: number,
  lon: number,
  rotation: number,
  isCopter: boolean,
  isGrounded: boolean,
  altitude: number | null
): string {
  const sunPos = SunCalc.getPosition(new Date(), lat, lon);
  const sunAzimuthMap = (sunPos.azimuth + Math.PI / 2) % (2 * Math.PI);
  const planeRotRad = ((isCopter ? 0 : rotation) * Math.PI) / 180;
  const shadowAngle = sunAzimuthMap + Math.PI - planeRotRad;
  const altMeters = altitude ?? 0;
  const sunAlt = sunPos.altitude;
  const baseLength = sunAlt > 0 ? Math.min(20, 10 / Math.tan(sunAlt)) : 0;
  const altFactor = Math.min(altMeters / 12000, 1);
  const length = baseLength * (1 + altFactor);
  const shadowDx = length * Math.cos(shadowAngle);
  const shadowDy = length * Math.sin(shadowAngle);
  if (isGrounded || length <= 0) return '';
  return `filter: drop-shadow(${shadowDx.toFixed(1)}px ${shadowDy.toFixed(1)}px 1px rgba(0,0,1,0.6));`;
}

export function buildPlaneMarkerClassString(
  isCopter: boolean,
  isUnknown: boolean,
  iconType: string,
  isNew: boolean,
  isGrounded: boolean,
  isMilitary: boolean,
  followed: boolean
): string {
  return `plane-marker ${
    !isCopter && !isUnknown ? 'svg-plane ' : ''
  }${!isCopter && !isUnknown ? iconType + ' ' : ''}${
    isNew && isGrounded ? 'new-and-grounded' : isGrounded ? 'grounded-plane' : ''
  } ${isMilitary ? 'military-plane' : ''} ${isCopter ? 'copter-plane' : ''}${
    isUnknown ? ' unknown-plane' : ''
  }${followed ? ' followed-plane' : ''}`;
}
