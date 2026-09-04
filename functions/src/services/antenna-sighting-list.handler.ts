import { onRequest } from '../on-request';
import { applyCors, handleOptionsPreflight } from '../http';
import { logger } from '../pi-logger';
import {
  parseAntennaListQuery,
  queryAntennaSightings,
} from './antenna-sighting-query';
import { getAntennaPollerStatus, getAntennaSightingStore } from './antenna-sighting-poller';

export function createGetAntennaSightingsHandler() {
  return onRequest(
    { cors: true, timeoutSeconds: 15, region: 'europe-west3' },
    async (req, res) => {
      applyCors(res, 'GET, OPTIONS');
      if (handleOptionsPreflight(req, res)) return;
      if (req.method !== 'GET') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
      }

      try {
        const query = parseAntennaListQuery(
          req.query as Record<string, unknown>,
        );
        const store = getAntennaSightingStore();
        const { rows, matched } = queryAntennaSightings(
          store.snapshot().sightings,
          query,
        );
        const status = getAntennaPollerStatus();
        res.json({
          ok: true,
          ...status,
          matched,
          returned: rows.length,
          sightings: rows,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('antennaSightings handler failed', { error: message });
        res.status(500).json({ ok: false, error: message });
      }
    },
  );
}
