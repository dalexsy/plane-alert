/**
 * Helicopter signals for the military alert gate (ADS-B category, type, callsign).
 * Model-less military helis (rescue / RESQ) are treated as boring.
 */
import type { AdsBPlane } from './types';
/** ADS-B filler tokens that look like a type/model but are not a real aircraft. */
export declare function isJunkAircraftIdentityToken(value?: string | null): boolean;
/** ADS-B emitter category A7 = rotorcraft. */
export declare function isHelicopterCategory(category?: string): boolean;
/** ICAO type designators that are rotorcraft. */
export declare function isHelicopterTypeCode(icaoType?: string): boolean;
/** Callsigns that are almost always rotorcraft (incl. German SAR RESQ). */
export declare function isHelicopterCallsign(callsign?: string): boolean;
/**
 * True when we have a real type code or a descriptive model name.
 * SPA placeholder "Helicopter" and ADS-B junk (mlat, unknown, …) do not count.
 */
export declare function hasMeaningfulAircraftModel(plane: AdsBPlane): boolean;
export declare function isLikelyHelicopter(plane: AdsBPlane): boolean;
//# sourceMappingURL=military-helicopter.d.ts.map