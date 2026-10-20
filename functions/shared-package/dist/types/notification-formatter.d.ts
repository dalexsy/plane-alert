/**
 * Shared notification formatting logic used by both frontend and backend
 */
export interface NotificationData {
    callsign?: string;
    icao: string;
    direction?: string;
    bearing?: number;
    planeHeading?: number;
    flagEmoji?: string;
    operator?: string;
    speed?: number;
    speedUnit: 'mph' | 'km/h';
    altitude?: number;
    altitudeUnit: 'ft' | 'm';
    verticalRate?: number;
    /** Human-readable place name only — never lat/lon or ARINC coord codes */
    location?: string;
    route?: string;
}
/**
 * True when a string is lat/lon (decimal, ARINC, NSEW packs) — not for end users.
 */
export declare function isCoordinateLikeLocation(value: string | null | undefined): boolean;
/** Keep only place names humans can read. Drops lat/lon and coord codes. */
export declare function humanReadableLocation(value: string | null | undefined): string | undefined;
/**
 * Get arrow for cardinal direction
 */
export declare function getArrowForDirection(direction: string): string;
/** Join non-empty notification segments without stray separators. */
export declare function joinNotificationParts(parts: Array<string | undefined | null>): string;
/** Nearby place plus bearing from home, e.g. `Rudow SE`. */
export declare function formatPlaceAndBearingFromHome(location?: string, direction?: string): string | undefined;
/** Aircraft track as compact heading text, e.g. `E-bound`. */
export declare function formatHeadingBound(planeHeading: number): string;
/**
 * Convert country code to flag emoji
 */
export declare function getCountryFlagEmoji(countryCode: string): string;
/**
 * Notification title (no flags or decorative emoji).
 * Model + operator when both exist; else model, callsign, operator, or ICAO; else fallback.
 * Operator is shown in the title only alongside a model (not with callsign-only titles).
 * @param _flagEmoji Ignored (kept for call-site compatibility).
 */
export declare function formatNotificationTitle(_flagEmoji?: string, model?: string, callsign?: string, icao?: string, operator?: string): string;
/**
 * Compact notification body for phone lock screens.
 * Format: `Rudow SE · E-bound · 7,600 m ↑` (omits missing fields).
 * @param _skipCallsignInBody Ignored (callsign lives in the title when needed).
 */
export declare function formatNotificationBody(data: NotificationData, _skipCallsignInBody?: boolean): string;
//# sourceMappingURL=notification-formatter.d.ts.map