/**
 * Common military aircraft types for filtering
 * Shared between frontend and backend
 */

export interface MilitaryAircraftType {
  code: string;
  name: string;
}

export const COMMON_MILITARY_TYPES: readonly MilitaryAircraftType[] = [
  { code: 'C130', name: 'C-130 Hercules' },
  { code: 'C30J', name: 'C-130J Super Hercules' },
  { code: 'A400', name: 'A400M Atlas' },
  { code: 'C17', name: 'C-17 Globemaster' },
  { code: 'KC135', name: 'KC-135 Stratotanker' },
  { code: 'KC10', name: 'KC-10 Extender' },
  { code: 'KC46', name: 'KC-46 Pegasus' },
  { code: 'E3', name: 'E-3 Sentry (AWACS)' },
  { code: 'E2', name: 'E-2 Hawkeye' },
  { code: 'P8', name: 'P-8 Poseidon' },
  { code: 'F16', name: 'F-16 Fighting Falcon' },
  { code: 'F15', name: 'F-15 Eagle' },
  { code: 'F18', name: 'F-18 Hornet' },
  { code: 'F22', name: 'F-22 Raptor' },
  { code: 'F35', name: 'F-35 Lightning II' },
  { code: 'A10', name: 'A-10 Thunderbolt II' },
  { code: 'B52', name: 'B-52 Stratofortress' },
  { code: 'B1', name: 'B-1 Lancer' },
  { code: 'B2', name: 'B-2 Spirit' },
  { code: 'CH47', name: 'CH-47 Chinook' },
  { code: 'UH60', name: 'UH-60 Black Hawk' },
  { code: 'AH64', name: 'AH-64 Apache' },
] as const;
