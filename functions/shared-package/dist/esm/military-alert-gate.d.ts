import type { AdsBPlane } from './types';
export type AlertAircraftOptions = {
    /** User/special-list ICAO — always alerts, even if boring. */
    isSpecial?: boolean;
};
/**
 * Single alert gate for Pushover and audio (kiosk PipeWire, SPA MP3/TTS).
 * Special always alerts. Otherwise: military candidate and not boring.
 */
export declare function shouldAlertForAircraft(plane: AdsBPlane, options?: AlertAircraftOptions): boolean;
/** SPA plane fields → AdsBPlane so the shared gate runs without a second filter. */
export declare function planeFieldsToAdsB(fields: {
    icao: string;
    callsign?: string;
    model?: string;
    type?: string;
    isMilitary?: boolean;
}): AdsBPlane;
//# sourceMappingURL=military-alert-gate.d.ts.map