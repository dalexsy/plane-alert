import * as fs from 'fs';
import * as path from 'path';
import type {
  AntennaSighting,
  AntennaSightingsFile,
  AntennaSnapshotAc,
} from './antenna-sighting.types';
import { applySnapshot } from './antenna-sighting-upsert';

const EMPTY: AntennaSightingsFile = {
  version: 1,
  updatedAt: 0,
  feedUrl: '',
  lastPollAt: null,
  lastPollOk: false,
  lastPollError: null,
  lastAircraft: 0,
  sightings: {},
};

export function defaultAntennaStorePath(): string {
  return (
    process.env.PLANES_ANTENNA_SIGHTINGS_PATH?.trim() ||
    path.join(process.cwd(), 'data', 'antenna-sightings.json')
  );
}

function readFile(filePath: string): AntennaSightingsFile {
  if (!fs.existsSync(filePath)) return { ...EMPTY, sightings: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<
      AntennaSightingsFile
    >;
    if (!raw || typeof raw !== 'object') return { ...EMPTY, sightings: {} };
    const sightings =
      raw.sightings && typeof raw.sightings === 'object'
        ? (raw.sightings as Record<string, AntennaSighting>)
        : {};
    return {
      version: 1,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
      feedUrl: typeof raw.feedUrl === 'string' ? raw.feedUrl : '',
      lastPollAt: typeof raw.lastPollAt === 'number' ? raw.lastPollAt : null,
      lastPollOk: raw.lastPollOk === true,
      lastPollError:
        typeof raw.lastPollError === 'string' ? raw.lastPollError : null,
      lastAircraft:
        typeof raw.lastAircraft === 'number' ? raw.lastAircraft : 0,
      sightings,
    };
  } catch {
    return { ...EMPTY, sightings: {} };
  }
}

function writeAtomic(filePath: string, data: AntennaSightingsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

export class AntennaSightingStore {
  private state: AntennaSightingsFile;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    this.state = readFile(filePath);
  }

  snapshot(): AntennaSightingsFile {
    return this.state;
  }

  uniqueHexes(): number {
    return Object.keys(this.state.sightings).length;
  }

  applyAircraft(
    aircraft: AntennaSnapshotAc[],
    now: number,
    feedUrl: string,
  ): number {
    const { byHex, upserted } = applySnapshot(
      this.state.sightings,
      aircraft,
      now,
    );
    this.state = {
      version: 1,
      updatedAt: now,
      feedUrl,
      lastPollAt: now,
      lastPollOk: true,
      lastPollError: null,
      lastAircraft: aircraft.length,
      sightings: byHex,
    };
    this.enqueueWrite();
    return upserted;
  }

  markPollFailure(error: string, now: number, feedUrl: string): void {
    this.state = {
      ...this.state,
      feedUrl,
      lastPollAt: now,
      lastPollOk: false,
      lastPollError: error.slice(0, 300),
    };
    this.enqueueWrite();
  }

  private enqueueWrite(): void {
    const data = this.state;
    this.writeChain = this.writeChain
      .then(() => {
        writeAtomic(this.filePath, data);
      })
      .catch(() => {
        writeAtomic(this.filePath, data);
      });
  }
}
