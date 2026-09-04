/** One unique ICAO hex the home tar1090 receiver has seen. */
export type AntennaSighting = {
  hex: string;
  firstSeen: number;
  lastSeen: number;
  flights: string[];
  lastFlight: string;
  closestNm: number | null;
  closestDir: number | null;
  closestAt: number | null;
  altMin: number | null;
  altMax: number | null;
  category: string;
  hits: number;
  messages: number;
  lastMessages: number | null;
};

export type AntennaSnapshotAc = {
  hex?: unknown;
  flight?: unknown;
  alt_baro?: unknown;
  r_dst?: unknown;
  r_dir?: unknown;
  category?: unknown;
  messages?: unknown;
  seen?: unknown;
};

export type AntennaPollerStatus = {
  enabled: boolean;
  feedUrl: string;
  pollMs: number;
  storePath: string;
  lastPollAt: number | null;
  lastPollOk: boolean;
  lastPollError: string | null;
  lastAircraft: number;
  uniqueHexes: number;
};

export type AntennaSightingsFile = {
  version: 1;
  updatedAt: number;
  feedUrl: string;
  lastPollAt: number | null;
  lastPollOk: boolean;
  lastPollError: string | null;
  lastAircraft: number;
  sightings: Record<string, AntennaSighting>;
};

export type AntennaListSort = 'lastSeen' | 'closest';

export type AntennaListQuery = {
  q?: string;
  sort?: AntennaListSort;
  today?: boolean;
  limit?: number;
  now?: number;
};
