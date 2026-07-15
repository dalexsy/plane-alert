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
/**
 * Convert country code to flag emoji
 */
export declare function getCountryFlagEmoji(countryCode: string): string;
/**
 * Format notification title with flag emoji and aircraft identifier
 * Format: "[flag] [model]" if model exists, otherwise "[flag] [callsign]"
 */
export declare function formatNotificationTitle(flagEmoji: string, model?: string, callsign?: string, icao?: string): string;
/**
 * Format notification body - single source of truth for both desktop and push notifications
 * Format: "over [location] to the [bearing] flying [heading] • [callsign] • [speed] • [altitude]"
 * @param data Notification data
 * @param skipCallsignInBody If true, omits the callsign from the body (when it's already in the title)
 */
export declare function formatNotificationBody(data: NotificationData, skipCallsignInBody?: boolean): string;
//# sourceMappingURL=notification-formatter.d.ts.map