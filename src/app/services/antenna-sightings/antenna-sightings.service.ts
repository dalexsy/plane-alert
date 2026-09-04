import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { antennaSightingsEndpoint } from '../../config/planes-api.config';

export type AntennaSightingRow = {
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
};

export type AntennaSightingsResponse = {
  ok: boolean;
  enabled?: boolean;
  feedUrl?: string;
  pollMs?: number;
  storePath?: string;
  lastPollAt?: number | null;
  lastPollOk?: boolean;
  lastPollError?: string | null;
  lastAircraft?: number;
  uniqueHexes?: number;
  matched?: number;
  returned?: number;
  sightings?: AntennaSightingRow[];
  error?: string;
};

export type AntennaSightingsQuery = {
  q?: string;
  sort?: 'lastSeen' | 'closest';
  today?: boolean;
};

function reportFetchError(err: unknown): void {
  const report = (
    globalThis as unknown as {
      drylReportError?: (v: unknown, ctx?: object, level?: string) => void;
    }
  ).drylReportError;
  report?.(
    err instanceof Error ? err : new Error(String(err)),
    { source: 'planes', kind: 'antenna-sightings' },
    'error',
  );
}

@Injectable({ providedIn: 'root' })
export class AntennaSightingsService {
  constructor(private readonly http: HttpClient) {}

  async list(query: AntennaSightingsQuery): Promise<AntennaSightingsResponse> {
    const params: Record<string, string> = {};
    if (query.q?.trim()) params['q'] = query.q.trim();
    if (query.sort === 'closest') params['sort'] = 'closest';
    if (query.today) params['today'] = '1';
    try {
      return await firstValueFrom(
        this.http.get<AntennaSightingsResponse>(antennaSightingsEndpoint, {
          params,
        }),
      );
    } catch (err) {
      reportFetchError(err);
      throw err;
    }
  }
}
