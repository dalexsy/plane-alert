import { createGetAntennaSightingsHandler } from './services/antenna-sighting-list.handler';
import { startAntennaSightingsPoller } from './services/antenna-sighting-poller';

export function createAntennaSightingsFunctions() {
  return {
    getAntennaSightings: createGetAntennaSightingsHandler(),
  };
}

export { startAntennaSightingsPoller };
