import { LocalFirestore } from './local-firestore';
import * as admin from './admin-compat';
import { createSaveMilitarySightingHandler } from './services/military-history-save.handler';
import { createGetMilitaryHistoryHandler } from './services/military-history-fetch.handler';

export type { MilitaryHistorySighting } from './military-history.types';

export function createMilitaryHistoryFunctions(db: LocalFirestore) {
  return {
    saveMilitarySighting: createSaveMilitarySightingHandler(db),
    getMilitaryHistory: createGetMilitaryHistoryHandler(db),
  };
}
