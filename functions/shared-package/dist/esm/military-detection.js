/**
 * Military aircraft detection and classification logic
 */
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
    'A359', // Airbus A350-900 (commercial airliner)
    'A35K', // Airbus A350-1000 (commercial airliner)
    'B737', // Boeing 737 (commercial airliner)
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
export function normalizeCallsign(value) {
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
export function looksMilitary(plane) {
    // Check mil flag OR dbFlags (dbFlags: 1 indicates military aircraft in database)
    // Reject if NEITHER flag indicates military
    if (!(plane.mil === true || plane.dbFlags === 1)) {
        return false;
    }
    // Skip boring aircraft types (trainers, transports, business jets, commercial airliners)
    const aircraftType = plane.t || plane.type || '';
    const normalizedType = aircraftType.toUpperCase().replace(/[-\s]/g, ''); // Remove dashes and spaces
    if (BORING_AIRCRAFT_TYPES.some((boring) => normalizedType.includes(boring))) {
        return false;
    }
    return true;
}
/**
 * Checks if a callsign matches known military prefixes
 */
export function isMilitaryCallsign(callsign) {
    if (!callsign) {
        return false;
    }
    const normalized = normalizeCallsign(callsign);
    return MIL_CALLSIGN_PREFIXES.some((prefix) => normalized.startsWith(prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase()));
}
/**
 * Checks if an operator name contains military keywords
 */
export function isMilitaryOperator(operatorName) {
    if (!operatorName) {
        return false;
    }
    const lowerName = operatorName.toLowerCase();
    return MIL_OPERATOR_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}
//# sourceMappingURL=military-detection.js.map