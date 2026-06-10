/**
 * Shared notification formatting logic used by both frontend and backend
 */

export interface NotificationData {
  callsign?: string;
  icao: string;
  direction?: string;
  bearing?: number; // Bearing from user to plane (0-360)
  planeHeading?: number; // Plane's track/heading (0-360)
  flagEmoji?: string;
  operator?: string;
  speed?: number;
  speedUnit: 'mph' | 'km/h';
  altitude?: number;
  altitudeUnit: 'ft' | 'm';
  verticalRate?: number; // in ft/min for consistency with ADS-B data
  location?: string; // Human-readable location or coordinates
  route?: string; // Flight route: "LAX→JFK (ETA 14:30 UTC)"
}

/**
 * Get arrow for cardinal direction
 */
export function getArrowForDirection(direction: string): string {
  const dir = direction.toUpperCase();
  const arrows: { [key: string]: string } = {
    N: '↑',
    NE: '↗',
    E: '→',
    SE: '↘',
    S: '↓',
    SW: '↙',
    W: '←',
    NW: '↖',
  };
  return arrows[dir] || '';
}

/**
 * Convert bearing to cardinal direction
 */
function bearingToCardinal(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((bearing % 360) / 45) % 8;
  return directions[index];
}

/**
 * Convert country code to flag emoji
 */
export function getCountryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown' || countryCode.length !== 2) {
    return '🏳️'; // White flag for unknown
  }

  // Convert country code to regional indicator symbols
  // A = U+1F1E6, so offset each letter by 0x1F1E6 - 0x41
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

/**
 * Format notification title with flag emoji and aircraft identifier
 * Format: "[flag] [model]" if model exists, otherwise "[flag] [callsign]"
 */
export function formatNotificationTitle(
  flagEmoji: string,
  model?: string,
  callsign?: string,
  icao?: string
): string {
  const flag = flagEmoji || '🏳️';

  // Use model if available, otherwise use callsign, otherwise use ICAO
  const identifier =
    model?.trim() || callsign?.trim() || icao?.toUpperCase() || '';

  if (!identifier) {
    return flag; // Just flag if nothing else available
  }

  return `${flag} ${identifier}`;
}

/**
 * Format notification body - single source of truth for both desktop and push notifications
 * Format: "over [location] to the [bearing] flying [heading] • [callsign] • [speed] • [altitude]"
 * @param data Notification data
 * @param skipCallsignInBody If true, omits the callsign from the body (when it's already in the title)
 */
export function formatNotificationBody(
  data: NotificationData,
  skipCallsignInBody = false
): string {
  const callsign = data.callsign?.trim() || data.icao.toUpperCase();
  const flagEmoji = data.flagEmoji || '🏳️';

  // Build location/direction header
  let header = '';
  if (data.location) {
    header = `over ${data.location}`;
  }

  // Add "to the [bearing]" if bearing available
  if (data.direction) {
    const arrow = getArrowForDirection(data.direction);
    const directionText = arrow ? `${data.direction} ${arrow}` : data.direction;
    header += header ? ` to the ${directionText}` : `to the ${directionText}`;
  }

  // Add "flying [heading]" if plane heading available
  if (data.planeHeading !== undefined) {
    const headingCardinal = bearingToCardinal(data.planeHeading);
    const headingArrow = getArrowForDirection(headingCardinal);
    const headingText = headingArrow
      ? `${headingCardinal} ${headingArrow}`
      : headingCardinal;
    header += ` flying ${headingText}`;
  }

  // Build details array
  const parts: string[] = [];

  // Add header as first part if it exists
  if (header) {
    parts.push(header);
  }

  // Flag and callsign (skip if already in title)
  if (!skipCallsignInBody) {
    parts.push(`${flagEmoji} ${callsign}`);
  }

  // Operator (if available)
  if (data.operator) {
    parts.push(data.operator);
  }

  // Route (origin→destination with ETA)
  if (data.route) {
    parts.push(data.route);
  }

  // Speed (if available)
  if (data.speed && data.speed > 0) {
    const speed = Math.round(data.speed);
    parts.push(`${speed} ${data.speedUnit}`);
  }

  // Altitude (if available)
  if (data.altitude && data.altitude > 0) {
    const formattedAlt = Math.round(data.altitude).toLocaleString('en-US');
    let altitudeText = `${formattedAlt} ${data.altitudeUnit}`;

    // Add vertical rate arrow (verticalRate is in ft/min)
    if (data.verticalRate && Math.abs(data.verticalRate) > 64) {
      if (data.verticalRate > 0) {
        altitudeText += ' ↗'; // Ascending
      } else {
        altitudeText += ' ↘'; // Descending
      }
    }
    parts.push(altitudeText);
  }

  // Join with bullets
  return parts.join(' • ');
}
