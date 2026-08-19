/**
 * Military aircraft detection and classification logic
 */

import type { AdsBPlane } from './types';
import { getAircraftTypeName } from './aircraft-type-names';
import {
  hasMeaningfulAircraftModel,
  isJunkAircraftIdentityToken,
  isLikelyHelicopter,
} from './military-helicopter';

/**
 * Boring aircraft types to skip (trainers, transports, business jets used by military)
 * These are not interesting for notifications even though they might be military-operated
 */
export const BORING_AIRCRAFT_TYPES = [
  'A319', // Airbus A319 (commercial airliner)
  'A320', // Airbus A320 (commercial airliner)
  'A20N', // Airbus A320neo (commercial airliner)
  'A321', // Airbus A321 (commercial airliner)
  'A21N', // Airbus A321neo (commercial airliner)
  'A330', // Airbus A330 (commercial airliner)
  'A332', // Airbus A330-200
  'A333', // Airbus A330-300
  'A339', // Airbus A330-900neo
  'A350', // Airbus A350 (commercial airliner)
  'A359', // Airbus A350-900
  'A35K', // Airbus A350-1000
  'B737', // Boeing 737 (commercial airliner)
  'B738', // Boeing 737-800 (commercial airliner)
  'B739', // Boeing 737-900 (commercial airliner)
  'B37M', // Boeing 737 MAX (commercial airliner)
  'B38M', // Boeing 737 MAX 8 (commercial airliner)
  'B39M', // Boeing 737 MAX 9 (commercial airliner)
  'B763', // Boeing 767-300
  'B764', // Boeing 767-400
  'B772', // Boeing 777-200
  'B773', // Boeing 777-300
  'B77L', // Boeing 777-200LR
  'B77W', // Boeing 777-300ER
  'B788', // Boeing 787-8
  'B789', // Boeing 787-9
  'B78X', // Boeing 787-10
  'B190', // Beechcraft 1900
  'B200', // Beechcraft Super King Air 200 (alternate ICAO code)
  'B300', // Beechcraft Super King Air 300 (alternate ICAO code)
  'B350', // Beechcraft King Air 350 (alternate ICAO code)
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
  'CRJ1', // Bombardier CRJ100/200
  'CRJ2', // Bombardier CRJ200
  'CRJ7', // Bombardier CRJ700
  'CRJ9', // Bombardier CRJ900
  'CRJX', // Bombardier CRJ1000
  'DHC6', // De Havilland Twin Otter (utility)
  'DHC8', // De Havilland Dash 8 (transport)
  'E50P', // Embraer Phenom 100
  'E55P', // Embraer Phenom 300
  'FA7X', // Dassault Falcon 7X
  'FA10', // Dassault Falcon 10
  'FA20', // Dassault Falcon 20
  'FA50', // Dassault Falcon 50
  'FA8X', // Dassault Falcon 8X
  'FA2T', // Dassault Falcon 2000
  'F2TH', // Dassault Falcon 2000 (alternate ICAO code)
  'F900', // Dassault Falcon 900
  'E35L', // Embraer Legacy 600/650
  'GLF2', // Gulfstream II
  'GLF3', // Gulfstream III
  'H25B', // Hawker 800
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
  'PC24', // Pilatus PC-24 (jet trainer)
  'PC6', // Pilatus Porter (utility)
  'PC9', // Pilatus PC-9 (trainer)
  'SF50', // Cirrus SF50 Vision Jet
  'SW4', // Fairchild Swearingen Metroliner / C-26
  'TEX2', // Raytheon/Beechcraft T-6 Texan II (trainer)
  'C295', // Airbus C295 transport
  'D328', // Dornier 328
  'E110', // Embraer Bandeirante
  'CN35', // CASA CN-235 transport
  'T134', // Tupolev Tu-134 (old transport)
  'T154', // Tupolev Tu-154 (old transport)
  'T37', // Northrop T-37 Tweet (trainer)
  'T38', // Northrop T-38 Talon (trainer)
  'A109', // Agusta A109 (liaison/VIP)
  'A139', // AgustaWestland AW139 (liaison/VIP)
  // Helicopters — liaison/training/utility types used by military (not combat)
  'AS50', // Aérospatiale AS350 Ecureuil / H125 (utility)
  'AS55', // Aérospatiale AS355 Twin Ecureuil (utility)
  'AS65', // Aérospatiale AS365 Dauphin / HH-65 (liaison)
  'B06',  // Bell 206 JetRanger (training/liaison)
  'B212', // Bell 212 (utility transport)
  'B407', // Bell 407 (utility)
  'BK17', // MBB/Airbus BK117 (utility/liaison)
  'EC20', // SA341/SA342 Gazelle (old trainer/liaison)
  'EC35', // Eurocopter EC135 / H135 (training/police)
  'EC45', // Eurocopter EC145 / H145 (utility/liaison)
  'EC55', // Eurocopter EC155 / H155 (medium utility)
  'H125', // Airbus H125 (utility)
  'H135', // Airbus H135 (training)
  'H145', // Airbus H145 (utility/liaison)
  'MD52', // MD520N (utility)
  'MD53', // MD530 (utility)
  'R22',  // Robinson R22 (basic trainer)
  'R44',  // Robinson R44 (trainer)
  'R66',  // Robinson R66 (trainer)
  'S300', // Schweizer 300 (training)
  'S76',  // Sikorsky S-76 (VIP/liaison)
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
  'CNV',
  'CTM',
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
  'MMF',
  'MFG',
  'NAF',
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
 * Callsign prefixes that should never notify. Everything else (RCH, PAT, SPAR,
 * CTM, MAM, CNV, GAF, …) is judged by type/desc — those fleets carry models we want.
 */
export const BORING_MIL_CALLSIGN_PREFIXES = [
  'MMF', // NATO Multinational MRTT Fleet (A330 tankers)
  'JOKER', // Helicopter callsigns — rarely over Berlin
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
 * 1. Must have military flag (mil=true) OR database flags (dbFlags=1)
 * 2. Must NOT be a boring aircraft type (trainers, business jets, etc.)
 *
 * @param plane Aircraft data from ADS-B API
 * @returns true if aircraft is interesting military, false otherwise
 */
/** Tankers, MRTTs, and similar types share ICAO codes with commercial airliners. */
const INTERESTING_BORING_OVERRIDE_DESC =
  /KC-?30|MRTT|TANKER|REFUEL|AWACS|SENTRY|E-3|E-6|MARITIME PATROL|P-8|POSEIDON/i;

/**
 * Military designators in ADS-B desc often omit ICAO type codes (e.g. "T-6A Texan II"
 * with t=TEX2, or desc-only "Beech C-12U Huron"). Match common boring roles by name.
 */
const BORING_MIL_DESC_PATTERN =
  /\b(?:C|UC|TC)-12\b|\bHURON\b|\bT-1A?\s*JAYHAWK\b|\bT-6[AB]?\b|TEXAN\s*(?:II|T\.?\s*1\b)|\bT-3[78]\b|\bTALON\b|\bMC-12|\bC-21\b|\bC-37|\bC-40|\bUC-35|\bC-26\b|\bU-28\b|METROLINER|CN-?235|\bC295\b|\bKING\s*AIR\b|\bSUPER\s*KING\s*AIR\b|\bCITATION\b|\bGULFSTREAM\b|\bLEAR\s*JET\b|\bLEARJET\b|\bPC-12\b|\bPC-21\b|\bPC-9\b|\bCARAVAN\b/i;

/**
 * When ADS-B has no ICAO type code, desc must name a non-boring role (fighters,
 * tankers, heavy transport). Operator-only strings like "United States Air Force"
 * are not enough to justify a Pushover alert.
 */
const INTERESTING_MIL_DESC_PATTERN =
  /\bF-?\d{2}\b|\bF\d{2}\b|\bE-?\d{1,2}\b|\bH?C-?\s*130J?\b|\bC-?\s*17\b|\bC-?\s*5\b|\bB-?\d{1,2}\b|\bA-?10\b|\bKC-?\d{2,3}\b|\bP-?\d\b|\bCH-?\d{2}\b|\bUH-?\d{2}\b|\bAH-?\d{2}\b|HERCULES|GLOBEMASTER|CHINOOK|APACHE|BLACK\s*HAWK|TYPHOON|TORNADO|RAFALE|GRIPEN|HORNET|EAGLE|RAPTOR|LIGHTNING|THUNDERBOLT|POSEIDON|STRATOFORT|ORION|AWACS|SENTRY|MRTT|TANKER|REFUEL|COMBAT\s*KING/i;

/**
 * Boring-type filter applies when mil/dbFlags mark an aircraft military but the ICAO
 * type is usually a civilian airframe (A332, GLEX, CL35, …). Skip only for roles that
 * are interesting despite the type code — e.g. KC-46 on a non-boring type. Boring
 * types are checked first, so A330 MRTT/MMF tracks stay filtered.
 */
export function shouldSkipBoringMilitaryFilter(plane: AdsBPlane): boolean {
  const desc = (plane.desc || '').toUpperCase();
  return INTERESTING_BORING_OVERRIDE_DESC.test(desc);
}

function getNormalizedTypeCode(plane: AdsBPlane): string {
  const raw = (plane.t || plane.type || '').toUpperCase().replace(/[-\s]/g, '');
  if (!raw || isJunkAircraftIdentityToken(raw)) return '';
  return raw;
}

function matchesBoringAircraftTypeOrDesc(
  normalizedType: string,
  desc: string,
): boolean {
  if (
    normalizedType &&
    BORING_AIRCRAFT_TYPES.some((boring) => normalizedType.includes(boring))
  ) {
    return true;
  }

  if (!desc) {
    return false;
  }

  const descUpper = desc.toUpperCase();
  if (BORING_MIL_DESC_PATTERN.test(descUpper)) {
    return true;
  }

  const descNormalized = descUpper.replace(/[-\s]/g, '');
  if (BORING_AIRCRAFT_TYPES.some((boring) => descNormalized.includes(boring))) {
    return true;
  }

  return BORING_AIRCRAFT_TYPES.some((boring) => {
    const modelName = getAircraftTypeName(boring);
    if (!modelName || modelName === boring) {
      return false;
    }
    return descUpper.includes(modelName.toUpperCase());
  });
}

/**
 * Returns true when a military-flagged aircraft is a trainer, transport,
 * business jet, or other type that should not trigger push notifications.
 */
export function isBoringMilitaryAircraft(plane: AdsBPlane): boolean {
  const callsign = plane.flight || plane.callsign;
  if (isBoringMilitaryCallsign(callsign)) {
    return true;
  }

  // Rescue / utility mil helis without a real model (RESQ, category A7, …).
  // With a type/desc we keep existing boring-type filters so Apaches etc. can alert.
  if (isLikelyHelicopter(plane) && !hasMeaningfulAircraftModel(plane)) {
    return true;
  }

  const normalizedType = getNormalizedTypeCode(plane);
  // Junk identity only (mlat / unknown) — treat like untyped mil transports.
  const rawDesc = (plane.desc || '').trim();
  const desc = isJunkAircraftIdentityToken(rawDesc) ? '' : rawDesc;
  if (!normalizedType && !desc && !hasMeaningfulAircraftModel(plane)) {
    if (normalizeCallsign(callsign).startsWith('USAF')) return true;
    if (isMilitaryCallsign(callsign) && !isBoringMilitaryCallsign(callsign)) {
      return false;
    }
    if (plane.mil === true || plane.dbFlags === 1 || isMilitaryCallsign(callsign)) {
      return true;
    }
  }

  // Boring airliner types (A332, B738, …) win over MRTT/MMF overrides — an A330
  // MRTT is still a normal transport, not an interesting military sighting.
  if (matchesBoringAircraftTypeOrDesc(normalizedType, desc)) {
    return true;
  }

  if (shouldSkipBoringMilitaryFilter(plane)) {
    return false;
  }

  if (!desc) {
    if (normalizedType) {
      return false;
    }
    // Untyped USAF tracks are almost always VIP/cargo, not airshow fighters.
    if (normalizeCallsign(callsign).startsWith('USAF')) {
      return true;
    }
    // Interesting callsigns (RRR, GAF, RCH, BAF, …) without type/desc still warrant alerts.
    // Only MMF/JOKER are filtered above via isBoringMilitaryCallsign.
    if (isMilitaryCallsign(callsign) && !isBoringMilitaryCallsign(callsign)) {
      return false;
    }
    // mil/dbFlags without type/desc is usually a boring transport.
    if (plane.mil === true || plane.dbFlags === 1) {
      return true;
    }
    if (isMilitaryCallsign(callsign)) {
      return true;
    }
    return false;
  }

  const descUpper = desc.toUpperCase();
  const hasMilitarySignal =
    plane.mil === true || plane.dbFlags === 1 || isMilitaryCallsign(callsign);

  if (
    hasMilitarySignal &&
    !INTERESTING_MIL_DESC_PATTERN.test(descUpper)
  ) {
    if (!normalizedType) {
      if (normalizeCallsign(callsign).startsWith('USAF')) {
        return true;
      }
      if (isMilitaryCallsign(callsign) && !isBoringMilitaryCallsign(callsign)) {
        return false;
      }
      return true;
    }
    // Typed tracks (EUFI, TOR, …) are not boring just because desc is operator-only.
  }

  return false;
}

export function looksMilitary(plane: AdsBPlane): boolean {
  // Check mil flag OR dbFlags (dbFlags: 1 indicates military aircraft in database)
  // Reject if NEITHER flag indicates military
  if (!(plane.mil === true || plane.dbFlags === 1)) {
    return false;
  }

  return !isBoringMilitaryAircraft(plane);
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

export function isBoringMilitaryCallsign(callsign?: string): boolean {
  if (!callsign) {
    return false;
  }

  const normalized = normalizeCallsign(callsign);

  return BORING_MIL_CALLSIGN_PREFIXES.some((prefix) =>
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
