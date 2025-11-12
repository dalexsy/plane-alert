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
    verticalRate?: number;
}
/**
 * Get arrow for cardinal direction
 */
export declare function getArrowForDirection(direction: string): string;
/**
 * Convert country code to flag emoji
 */
export declare function getCountryFlagEmoji(countryCode: string): string;
/**
 * Format notification body - single source of truth for both desktop and push notifications
 * Returns: "Direction Arrow • Flag Callsign • Operator • Speed • Altitude"
 */
export declare function formatNotificationBody(data: NotificationData): string;
//# sourceMappingURL=notification-formatter.d.ts.map