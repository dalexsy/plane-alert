/**
 * Military aircraft detection and classification logic
 */
import type { AdsBPlane } from './types';
/**
 * Boring aircraft types to skip (trainers, transports, business jets used by military)
 * These are not interesting for notifications even though they might be military-operated
 */
export declare const BORING_AIRCRAFT_TYPES: string[];
/**
 * Military callsign prefixes used by air forces worldwide
 */
export declare const MIL_CALLSIGN_PREFIXES: string[];
/**
 * Military callsign prefixes that almost always indicate cargo, VIP, or
 * liaison flights — not fighters. Used when ADS-B has no mil flag or type.
 */
export declare const BORING_MIL_CALLSIGN_PREFIXES: string[];
/**
 * Military operator keywords (for operator name matching)
 */
export declare const MIL_OPERATOR_KEYWORDS: string[];
/**
 * Normalizes a callsign by removing non-alphanumeric characters
 */
export declare function normalizeCallsign(value?: string | null): string;
/**
 * Boring-type filter applies when mil/dbFlags mark an aircraft military but the ICAO
 * type is usually a civilian airframe (A332, GLEX, CL35, …). Skip only for roles that
 * are interesting despite the type code — not every military callsign (GAF VIP jets
 * should stay filtered).
 */
export declare function shouldSkipBoringMilitaryFilter(plane: AdsBPlane): boolean;
/**
 * Returns true when a military-flagged aircraft is a trainer, transport,
 * business jet, or other type that should not trigger push notifications.
 */
export declare function isBoringMilitaryAircraft(plane: AdsBPlane): boolean;
export declare function looksMilitary(plane: AdsBPlane): boolean;
/**
 * Checks if a callsign matches known military prefixes
 */
export declare function isMilitaryCallsign(callsign?: string): boolean;
export declare function isBoringMilitaryCallsign(callsign?: string): boolean;
/**
 * Checks if an operator name contains military keywords
 */
export declare function isMilitaryOperator(operatorName?: string): boolean;
//# sourceMappingURL=military-detection.d.ts.map