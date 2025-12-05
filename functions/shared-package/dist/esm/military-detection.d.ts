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
 * Military operator keywords (for operator name matching)
 */
export declare const MIL_OPERATOR_KEYWORDS: string[];
/**
 * Normalizes a callsign by removing non-alphanumeric characters
 */
export declare function normalizeCallsign(value?: string | null): string;
/**
 * Determines if an aircraft looks like an interesting military aircraft
 *
 * Logic:
 * 1. Must have military flag (mil=true) OR database flags (dbFlags=1)
 * 2. Must NOT be a boring aircraft type (trainers, business jets, etc.)
 *
 * @param plane Aircraft data from ADS-B API
 * @returns true if aircraft is interesting military, false otherwise
 */
export declare function looksMilitary(plane: AdsBPlane): boolean;
/**
 * Checks if a callsign matches known military prefixes
 */
export declare function isMilitaryCallsign(callsign?: string): boolean;
/**
 * Checks if an operator name contains military keywords
 */
export declare function isMilitaryOperator(operatorName?: string): boolean;
//# sourceMappingURL=military-detection.d.ts.map