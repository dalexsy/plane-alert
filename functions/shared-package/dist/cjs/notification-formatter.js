"use strict";
/**
 * Shared notification formatting logic used by both frontend and backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArrowForDirection = getArrowForDirection;
exports.getCountryFlagEmoji = getCountryFlagEmoji;
exports.formatNotificationTitle = formatNotificationTitle;
exports.formatNotificationBody = formatNotificationBody;
/**
 * Get arrow for cardinal direction
 */
function getArrowForDirection(direction) {
    const dir = direction.toUpperCase();
    const arrows = {
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
function bearingToCardinal(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((bearing % 360) / 45) % 8;
    return directions[index];
}
/**
 * Convert country code to flag emoji
 */
function getCountryFlagEmoji(countryCode) {
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
function formatNotificationTitle(flagEmoji, model, callsign, icao) {
    const flag = flagEmoji || '🏳️';
    // Use model if available, otherwise use callsign, otherwise use ICAO
    const identifier = model?.trim() || callsign?.trim() || icao?.toUpperCase() || '';
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
function formatNotificationBody(data, skipCallsignInBody = false) {
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
    const parts = [];
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
            }
            else {
                altitudeText += ' ↘'; // Descending
            }
        }
        parts.push(altitudeText);
    }
    // Join with bullets
    return parts.join(' • ');
}
//# sourceMappingURL=notification-formatter.js.map