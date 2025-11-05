/**
 * Military aircraft detection and classification logic
 */

import type { AdsBPlane } from './types';
import militaryAircraftDb from '../data/military-aircraft-db.json';

// Type the military database
const militaryDb: Record<string, { mil: boolean }> = militaryAircraftDb as any;

/**
 * Boring aircraft types to skip (trainers, transports, business jets used by military)
 * These are not interesting for notifications even though they might be military-operated
 */
export const BORING_AIRCRAFT_TYPES = [
  'BE20', // Beechcraft King Air (trainer/transport)
  'BE30', // Beechcraft Super King Air
  'BE35', // Beechcraft Bonanza
  'BE36', // Beechcraft Bonanza
  'BE40', // Beechcraft T-1 Jayhawk (trainer)
  'BE45', // Beechcraft T-6 Texan II (trainer)
  'BE9L', // Beechcraft King Air
  'BE9T', // Beechcraft King Air
  'C172', // Cessna 172 (basic trainer)
  'C182', // Cessna 182
  'C208', // Cessna Caravan (utility)
  'C25A', // Cessna Citation (business jet)
  'C25B', // Cessna Citation
  'C25C', // Cessna Citation
  'C501', // Cessna Citation
  'C510', // Cessna Citation Mustang
  'C525', // Cessna CitationJet
  'C550', // Cessna Citation II
  'C551', // Cessna Citation II/SP
  'C560', // Cessna Citation V
  'C56X', // Cessna Citation Excel
  'C650', // Cessna Citation III/VI/VII
  'C680', // Cessna Citation Sovereign
  'C750', // Cessna Citation X
  'CL30', // Bombardier Challenger 300
  'CL35', // Bombardier Challenger 350
  'CL60', // Bombardier Challenger 600/601/604/605
  'DHC6', // De Havilland Twin Otter (utility)
  'DHC8', // De Havilland Dash 8 (transport)
  'E50P', // Embraer Phenom 100
  'E55P', // Embraer Phenom 300
  'FA7X', // Dassault Falcon 7X
  'FA10', // Dassault Falcon 10
  'FA20', // Dassault Falcon 20
  'FA50', // Dassault Falcon 50
  'FA2T', // Dassault Falcon 2000
  'GL5T', // Gulfstream V
  'GLEX', // Bombardier Global Express
  'GLF4', // Gulfstream IV
  'GLF5', // Gulfstream V
  'GLF6', // Gulfstream G650
  'GLHF', // Gulfstream 100/150
  'LJ24', // Learjet 24
  'LJ25', // Learjet 25
  'LJ31', // Learjet 31
  'LJ35', // Learjet 35/36 (used as trainers)
  'LJ40', // Learjet 40
  'LJ45', // Learjet 45
  'LJ55', // Learjet 55
  'LJ60', // Learjet 60
  'P28A', // Piper PA-28 Cherokee (basic trainer)
  'PC12', // Pilatus PC-12 (utility)
  'PC21', // Pilatus PC-21 (trainer)
  'PC6', // Pilatus Porter (utility)
  'PC9', // Pilatus PC-9 (trainer)
  'SF50', // Cirrus SF50 Vision Jet
  'T134', // Tupolev Tu-134 (old transport)
  'T154', // Tupolev Tu-154 (old transport)
];

/**
 * Military callsign prefixes used by air forces worldwide
 */
export const MIL_CALLSIGN_PREFIXES = [
  'AEB',
  'AII',
  'AM',
  'AMX',
  'ARMY',
  'BAF',
  'BAH',
  'BKK',
  'BLK',
  'CEF', // Czech Air Force
  'CNV',
  'CTM',
  'DLH',
  'EAG',
  'FAG',
  'FAF',
  'FNY',
  'GAF',
  'HAF',
  'KAF',
  'LAGR',
  'LNX',
  'MAF',
  'MAM',
  'MFG',
  'NAF',
  'NATO', // NATO callsigns
  'NAVY',
  'PAT',
  'QID',
  'RCH',
  'RFF',
  'RRR',
  'SEN',
  'SPAR',
  'T.2',
  'TUAF',
  'USAF',
  'USCG',
  'VEN',
  'VV',
  'WCO',
];

/**
 * Military operator keywords (for operator name matching)
 */
export const MIL_OPERATOR_KEYWORDS = [
  'air force',
  'luchtmacht',
  'armée',
  "armée de l'air",
  'navy',
  'marine',
  'heer',
  'luftwaffe',
  'armée de terre',
  'army',
  'military',
  'marines',
  'gov',
  'government',
];

/**
 * Normalizes a callsign by removing non-alphanumeric characters
 */
export function normalizeCallsign(value?: string | null): string {
  if (!value) {
    return '';
  }
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Determines if an aircraft looks like an interesting military aircraft
 *
 * Logic:
 * 1. Check local military aircraft database (most reliable - same as frontend)
 * 2. Check API military flags (mil=true OR dbFlags=1)
 * 3. Check callsign prefixes as last resort fallback
 * 4. Filter out boring aircraft types (trainers, business jets, etc.)
 *
 * @param plane Aircraft data from ADS-B API
 * @returns true if aircraft is interesting military, false otherwise
 */
export function looksMilitary(plane: AdsBPlane): boolean {
  // First check: Local military database (same as frontend uses)
  const icaoLower = plane.hex?.toLowerCase();
  const inMilitaryDb = icaoLower && militaryDb[icaoLower]?.mil === true;

  // Second check: API flags (reliable when present)
  const hasApiMilitaryFlag = plane.mil === true || plane.dbFlags === 1;

  // Third check: Military callsign (fallback for when database and API both fail)
  const hasMilitaryCallsign = isMilitaryCallsign(
    plane.flight || plane.callsign
  );

  // Must have database entry, API flag, OR military callsign
  if (!(inMilitaryDb || hasApiMilitaryFlag || hasMilitaryCallsign)) {
    return false;
  }

  // Skip boring aircraft types (trainers, transports, business jets)
  const aircraftType = plane.t || plane.type || '';
  if (BORING_AIRCRAFT_TYPES.includes(aircraftType.toUpperCase())) {
    return false;
  }

  return true;
}

/**
 * Checks if a callsign matches known military prefixes
 */
export function isMilitaryCallsign(callsign?: string): boolean {
  if (!callsign) {
    return false;
  }

  const normalized = normalizeCallsign(callsign);

  return MIL_CALLSIGN_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase())
  );
}

/**
 * Checks if an operator name contains military keywords
 */
export function isMilitaryOperator(operatorName?: string): boolean {
  if (!operatorName) {
    return false;
  }

  const lowerName = operatorName.toLowerCase();

  return MIL_OPERATOR_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}
