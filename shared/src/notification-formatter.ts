/**
 * Shared notification formatting logic used by both frontend and backend
 */

export interface NotificationData {
  callsign?: string;
  icao: string;
  direction?: string;
  flagEmoji?: string;
  operator?: string;
  speed?: number;
  speedUnit: 'mph' | 'km/h';
  altitude?: number;
  altitudeUnit: 'ft' | 'm';
  verticalRate?: number; // in ft/min for consistency with ADS-B data
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
 * Format notification body - single source of truth for both desktop and push notifications
 * Returns: "Direction Arrow • Flag Callsign • Operator • Speed • Altitude"
 */
export function formatNotificationBody(data: NotificationData): string {
  const callsign = data.callsign?.trim() || data.icao.toUpperCase();
  const arrow = data.direction ? getArrowForDirection(data.direction) : '';
  const flagEmoji = data.flagEmoji || '🏳️';

  // Build parts array
  const parts: string[] = [];

  // Direction with arrow
  if (data.direction && arrow) {
    parts.push(`${data.direction} ${arrow}`);
  }

  // Flag and callsign
  parts.push(`${flagEmoji} ${callsign}`);

  // Operator (if available)
  if (data.operator) {
    parts.push(data.operator);
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
