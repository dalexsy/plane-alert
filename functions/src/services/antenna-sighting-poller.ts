import { logger } from '../pi-logger';
import type { AntennaPollerStatus } from './antenna-sighting.types';
import {
  antennaFeedUrl,
  antennaPollerEnabled,
  antennaPollMs,
  fetchAntennaSnapshot,
} from './antenna-sighting-feed';
import {
  AntennaSightingStore,
  defaultAntennaStorePath,
} from './antenna-sighting-store';

let store: AntennaSightingStore | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export function getAntennaSightingStore(): AntennaSightingStore {
  if (!store) {
    store = new AntennaSightingStore(defaultAntennaStorePath());
  }
  return store;
}

export function getAntennaPollerStatus(): AntennaPollerStatus {
  const snap = getAntennaSightingStore().snapshot();
  return {
    enabled: antennaPollerEnabled(),
    feedUrl: antennaFeedUrl(),
    pollMs: antennaPollMs(),
    storePath: defaultAntennaStorePath(),
    lastPollAt: snap.lastPollAt,
    lastPollOk: snap.lastPollOk,
    lastPollError: snap.lastPollError,
    lastAircraft: snap.lastAircraft,
    uniqueHexes: getAntennaSightingStore().uniqueHexes(),
  };
}

export async function pollAntennaSightingsOnce(): Promise<void> {
  const feedUrl = antennaFeedUrl();
  const now = Date.now();
  const db = getAntennaSightingStore();
  try {
    const snapshot = await fetchAntennaSnapshot(feedUrl);
    const upserted = db.applyAircraft(snapshot.aircraft, snapshot.at, feedUrl);
    logger.info('antenna sightings poll', {
      aircraft: snapshot.aircraft.length,
      upserted,
      uniqueHexes: db.uniqueHexes(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    db.markPollFailure(message, now, feedUrl);
    logger.warn('antenna sightings poll failed', { error: message, feedUrl });
  }
}

export function startAntennaSightingsPoller(): void {
  if (!antennaPollerEnabled()) {
    logger.info('antenna sightings poller disabled (PLANES_ANTENNA_ENABLED)');
    return;
  }
  if (timer) return;
  const ms = antennaPollMs();
  logger.info('antenna sightings poller starting', {
    feedUrl: antennaFeedUrl(),
    pollMs: ms,
    storePath: defaultAntennaStorePath(),
  });
  const tick = () => {
    if (inFlight) return;
    inFlight = true;
    void pollAntennaSightingsOnce().finally(() => {
      inFlight = false;
    });
  };
  tick();
  timer = setInterval(tick, ms);
  timer.unref?.();
}
