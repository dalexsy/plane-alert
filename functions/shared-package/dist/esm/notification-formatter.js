/**
 * Shared notification formatting logic used by both frontend and backend
 */
import { bearingToCardinal } from './geo-utils';
const NOTIFICATION_PART_SEP = ' · ';
const VERTICAL_RATE_THRESHOLD_FT_MIN = 64;
/**
 * True when a string is lat/lon (decimal, ARINC, NSEW packs) — not for end users.
 */
export function isCoordinateLikeLocation(value) {
    if (!value)
        return false;
    const c = value.trim();
    if (!c)
        return false;
    // Decimal pair: 52.5200, 13.4050  |  52.52 13.40  |  52.52/13.40
    if (/^-?\d{1,3}\.\d{2,}\s*[,/\s]\s*-?\d{1,3}\.\d{2,}$/.test(c))
        return true;
    // Compact decimals without separator noise: 52.5200,13.4050
    if (/^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/.test(c))
        return true;
    // ARINC / packed: 5230N01320E, N5230E01320, 5230N/01320E
    const upper = c.toUpperCase().replace(/\s+/g, '');
    if (/^\d{4}[NS]\d{5}[EW]$/.test(upper))
        return true;
    if (/^[NS]\d{4,6}[EW]\d{4,6}$/.test(upper))
        return true;
    if (/^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(upper))
        return true;
    // Degree symbols / DMS-ish: 52°31'N 13°24'E
    if (/\d{1,3}\s*°/.test(c) && /[NS]/i.test(c) && /[EW]/i.test(c))
        return true;
    // Bare "lat, lon" labels
    if (/\blat(itude)?\b/i.test(c) && /\blon(gitude)?\b/i.test(c))
        return true;
    return false;
}
/** Keep only place names humans can read. Drops lat/lon and coord codes. */
export function humanReadableLocation(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;
    if (isCoordinateLikeLocation(trimmed))
        return undefined;
    return trimmed;
}
/**
 * Get arrow for cardinal direction
 */
export function getArrowForDirection(direction) {
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
/** Join non-empty notification segments without stray separators. */
export function joinNotificationParts(parts) {
    return parts
        .map((p) => p?.trim())
        .filter((p) => Boolean(p))
        .join(NOTIFICATION_PART_SEP);
}
/** Nearby place plus bearing from home, e.g. `Rudow SE`. */
export function formatPlaceAndBearingFromHome(location, direction) {
    const place = humanReadableLocation(location);
    const dir = direction?.trim().toUpperCase();
    if (place && dir)
        return `${place} ${dir}`;
    if (place)
        return place;
    if (dir)
        return dir;
    return undefined;
}
/** Aircraft track as compact heading text, e.g. `E-bound`. */
export function formatHeadingBound(planeHeading) {
    const cardinal = bearingToCardinal(planeHeading);
    return `${cardinal}-bound`;
}
/**
 * Convert country code to flag emoji
 */
export function getCountryFlagEmoji(countryCode) {
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
 * Notification title (no flags or decorative emoji).
 * Model + operator when both exist; else model, callsign, operator, or ICAO; else fallback.
 * Operator is shown in the title only alongside a model (not with callsign-only titles).
 * @param _flagEmoji Ignored (kept for call-site compatibility).
 */
export function formatNotificationTitle(_flagEmoji, model, callsign, icao, operator) {
    const m = cleanNotificationField(model);
    const op = cleanNotificationField(operator);
    const cs = cleanNotificationField(callsign);
    const hex = icao?.trim().toUpperCase();
    if (m)
        return op ? joinNotificationParts([m, op]) : m;
    if (cs)
        return cs;
    if (op)
        return op;
    if (hex)
        return hex;
    return 'Aircraft nearby';
}
function cleanNotificationField(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;
    const lower = trimmed.toLowerCase();
    if (lower === 'undefined' || lower === 'null' || lower === 'unknown')
        return undefined;
    return trimmed;
}
/**
 * Compact notification body for phone lock screens.
 * Format: `Rudow SE · E-bound · 7,600 m ↑` (omits missing fields).
 * @param _skipCallsignInBody Ignored (callsign lives in the title when needed).
 */
export function formatNotificationBody(data, _skipCallsignInBody = false) {
    const placeBearing = formatPlaceAndBearingFromHome(data.location, data.direction);
    const headingPart = data.planeHeading !== undefined && Number.isFinite(data.planeHeading)
        ? formatHeadingBound(data.planeHeading)
        : undefined;
    let altitudePart;
    if (data.altitude && data.altitude > 0) {
        const formattedAlt = Math.round(data.altitude).toLocaleString('en-US');
        let altitudeText = `${formattedAlt} ${data.altitudeUnit}`;
        if (data.verticalRate && Math.abs(data.verticalRate) > VERTICAL_RATE_THRESHOLD_FT_MIN) {
            altitudeText += data.verticalRate > 0 ? ' ↑' : ' ↓';
        }
        altitudePart = altitudeText;
    }
    return joinNotificationParts([placeBearing, headingPart, altitudePart]);
}
//# sourceMappingURL=notification-formatter.js.map