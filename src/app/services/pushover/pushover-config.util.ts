import { PUSHOVER_USER_KEY } from '@plane-alert/shared';

export interface MilitaryAircraftType {
  code: string;
  name: string;
}

export const COMMON_MILITARY_TYPES: MilitaryAircraftType[] = [
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
];

export interface PushoverConfigState {
  ignoredTypes: Set<string>;
  customIgnoreList: string;
  radiusKm: number;
  distanceUnit: 'km' | 'miles';
  pushoverUserKey: string;
}

export function loadPushoverConfig(
  commonTypes: MilitaryAircraftType[],
  storedUserKey: string
): PushoverConfigState {
  const state: PushoverConfigState = {
    ignoredTypes: new Set(),
    customIgnoreList: '',
    radiusKm: 100,
    distanceUnit: 'km',
    pushoverUserKey: storedUserKey || PUSHOVER_USER_KEY,
  };
  const saved = localStorage.getItem('pushover-config');
  if (saved) {
    try {
      const config = JSON.parse(saved);
      state.ignoredTypes = new Set(config.ignoredTypes || []);
      state.radiusKm = config.radiusKm || 100;
      state.distanceUnit = config.distanceUnit || 'km';
      const customTypes = Array.from(state.ignoredTypes).filter(
        (type) => !commonTypes.some((mt) => mt.code === type.toUpperCase())
      );
      state.customIgnoreList = customTypes.join('\n');
    } catch (e) {
      console.error('Failed to load pushover config:', e);
    }
  }
  if (state.pushoverUserKey) {
    const deviceConfig = localStorage.getItem('pushover-device-config');
    if (deviceConfig) {
      try {
        const config = JSON.parse(deviceConfig);
        state.distanceUnit = config.distanceUnit || 'km';
        state.radiusKm = config.radiusKm || 100;
      } catch {
        /* ignore */
      }
    }
  }
  return state;
}

export function syncCustomIgnoreList(
  state: PushoverConfigState,
  commonTypes: MilitaryAircraftType[]
): void {
  const customTypes = state.customIgnoreList
    .split('\n')
    .map((line) => line.trim().toUpperCase())
    .filter((line) => line.length > 0);
  const commonCodes = new Set(commonTypes.map((mt) => mt.code.toUpperCase()));
  Array.from(state.ignoredTypes).forEach((type) => {
    if (!commonCodes.has(type)) state.ignoredTypes.delete(type);
  });
  customTypes.forEach((type) => state.ignoredTypes.add(type));
}

export function isTypeIgnored(state: PushoverConfigState, code: string): boolean {
  return state.ignoredTypes.has(code.toUpperCase());
}

export function toggleIgnoredType(state: PushoverConfigState, code: string): void {
  const upper = code.toUpperCase();
  if (state.ignoredTypes.has(upper)) state.ignoredTypes.delete(upper);
  else state.ignoredTypes.add(upper);
}
