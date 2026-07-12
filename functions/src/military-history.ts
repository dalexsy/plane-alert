import * as admin from 'firebase-admin';
import { createSaveMilitarySightingHandler } from './services/military-history-save.handler';
import { createGetMilitaryHistoryHandler } from './services/military-history-fetch.handler';

export type { MilitaryHistorySighting } from './military-history.types';

export function createMilitaryHistoryFunctions(db: admin.firestore.Firestore) {
  return {
    saveMilitarySighting: createSaveMilitarySightingHandler(db),
    getMilitaryHistory: createGetMilitaryHistoryHandler(db),
  };
}
