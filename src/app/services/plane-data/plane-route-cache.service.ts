import { Injectable } from '@angular/core';

export interface RouteMetadata {
  origin?: string;
  destination?: string;
  originIata?: string;
  destinationIata?: string;
  originName?: string;
  destinationName?: string;
  etaUtc?: string;
  status?: string;
  arrivalDelay?: number;
  cancelled?: boolean;
  diverted?: boolean;
}

/**
 * Detect coordinate-like strings that should never appear as airport identifiers.
 * AeroAPI can return ARINC-424 waypoints or lat/lon strings for military destinations.
 */
function looksLikeCoordinate(code: string): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (/^\d{4}[NS]\d{5}[EW]$/.test(c)) return true;
  if (/^[NS]\d{4,6}[EW]\d{4,6}$/.test(c)) return true;
  if (/^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(c)) return true;
  if (/^-?\d{1,3}\.\d+[,\/ ]\s*-?\d{1,3}\.\d+$/.test(c)) return true;
  return false;
}

@Injectable({
  providedIn: 'root',
})
export class PlaneRouteCacheService {
  private routeDataCache = new Map<string, RouteMetadata>();

  private formatEtaUtc(isoTime: unknown): string | undefined {
    if (typeof isoTime !== 'string' || !isoTime.trim()) return undefined;
    const ms = Date.parse(isoTime);
    if (Number.isNaN(ms)) return undefined;

    const date = new Date(ms);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}Z`;
  }

  /**
   * Update route cache from backend flightData payload (AeroAPI enrichment).
   */
  updateFromFlightData(flightData: Record<string, any>): void {
    for (const callsign in flightData) {
      const data = flightData[callsign];
      const originObj =
        data?.origin && typeof data.origin === 'object' ? data.origin : null;
      const destinationObj =
        data?.destination && typeof data.destination === 'object'
          ? data.destination
          : null;

      const originCode =
        typeof data?.origin === 'string'
          ? data.origin
          : typeof originObj?.code === 'string'
          ? originObj.code
          : undefined;
      const destinationCode =
        typeof data?.destination === 'string'
          ? data.destination
          : typeof destinationObj?.code === 'string'
          ? destinationObj.code
          : undefined;

      // Reject coordinate-like strings — they are waypoints, not airport codes
      const safeOriginCode =
        originCode && !looksLikeCoordinate(originCode) ? originCode : undefined;
      const safeDestinationCode =
        destinationCode && !looksLikeCoordinate(destinationCode)
          ? destinationCode
          : undefined;

      const etaIso =
        data?.estimatedIn ??
        data?.scheduledIn ??
        data?.estimatedOn ??
        data?.scheduledOn;
      const etaUtc = this.formatEtaUtc(etaIso);

      const status = typeof data?.status === 'string' ? data.status : undefined;
      const arrivalDelay =
        typeof data?.arrivalDelay === 'number' ? data.arrivalDelay : undefined;
      const cancelled =
        typeof data?.cancelled === 'boolean' ? data.cancelled : undefined;
      const diverted =
        typeof data?.diverted === 'boolean' ? data.diverted : undefined;

      const safeOriginName = typeof originObj?.name === 'string' ? originObj.name : undefined;
      const safeDestinationName = typeof destinationObj?.name === 'string' ? destinationObj.name : undefined;

      if (safeOriginCode || safeDestinationCode || safeOriginName || safeDestinationName || etaUtc || status) {
        const existing = this.routeDataCache.get(callsign) ?? {};
        this.routeDataCache.set(callsign, {
          ...existing,
          origin: safeOriginCode,
          destination: safeDestinationCode,
          originIata:
            typeof originObj?.codeIata === 'string'
              ? originObj.codeIata
              : existing.originIata,
          destinationIata:
            typeof destinationObj?.codeIata === 'string'
              ? destinationObj.codeIata
              : existing.destinationIata,
          originName: safeOriginName ?? existing.originName,
          destinationName: safeDestinationName ?? existing.destinationName,
          etaUtc: etaUtc ?? existing.etaUtc,
          status: status ?? existing.status,
          arrivalDelay: arrivalDelay ?? existing.arrivalDelay,
          cancelled: cancelled ?? existing.cancelled,
          diverted: diverted ?? existing.diverted,
        });
      }
    }
  }

  /**
   * Get cached route metadata.
   * Prefer callsign key (AeroAPI), fallback to ICAO key (OpenSky route data, if stored there).
   */
  get(callsign: string, icao: string): RouteMetadata | undefined {
    return this.routeDataCache.get(callsign) || this.routeDataCache.get(icao);
  }

  /**
   * Merge partial route updates (used by OpenSky route fallback).
   */
  merge(key: string, partial: RouteMetadata): void {
    const existing = this.routeDataCache.get(key) ?? {};
    this.routeDataCache.set(key, {
      ...existing,
      ...partial,
    });
  }
}
