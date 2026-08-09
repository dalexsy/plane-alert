import { onRequest } from './on-request';
import fetch from 'node-fetch';
import { applyCors, handleOptionsPreflight } from './http';
import {
  ceilingKindRank,
  distanceKm,
  parseMetarCeiling,
  type CeilingKind,
  type MetarRecord,
} from './services/weather-ceiling-parse.util';

interface StationInfo {
  icaoId?: string;
  iataId?: string;
  lat?: number;
  lon?: number;
}

export const weatherCeilingProxy = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    region: 'europe-west3',
  },
  async (req, res) => {
    applyCors(res, 'GET, OPTIONS');
    if (handleOptionsPreflight(req, res)) {
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res
        .status(400)
        .json({ error: 'lat and lon query parameters are required' });
      return;
    }

    try {
      const delta = 0.7;
      const stationUrl =
        `https://aviationweather.gov/api/data/stationinfo?format=json&bbox=` +
        `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;

      const stationRes = await fetch(stationUrl, { timeout: 8000 } as any);
      if (!stationRes.ok) {
        res.json({
          feet: null,
          stationCode: null,
          kind: 'unavailable' as CeilingKind,
        });
        return;
      }

      const stations = (await stationRes.json()) as StationInfo[];
      if (!Array.isArray(stations) || stations.length === 0) {
        res.json({
          feet: null,
          stationCode: null,
          kind: 'unavailable' as CeilingKind,
        });
        return;
      }

      const candidates = stations
        .filter((station) => typeof station.icaoId === 'string')
        .map((station) => ({
          station,
          stationLat: Number(station.lat),
          stationLon: Number(station.lon),
        }))
        .filter(
          (candidate) =>
            Number.isFinite(candidate.stationLat) &&
            Number.isFinite(candidate.stationLon),
        )
        .map((candidate) => ({
          station: candidate.station,
          distanceKm: distanceKm(
            lat,
            lon,
            candidate.stationLat,
            candidate.stationLon,
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 8);

      const metarResults = await Promise.all(
        candidates.map(async (candidate) => {
          const stationIcao = candidate.station.icaoId as string;
          try {
            const metarUrl = `https://aviationweather.gov/api/data/metar?format=json&ids=${stationIcao}`;
            const metarRes = await fetch(metarUrl, { timeout: 2500 } as any);
            if (!metarRes.ok || metarRes.status === 204) {
              return null;
            }

            const metars = (await metarRes.json()) as MetarRecord[];
            const metar =
              Array.isArray(metars) && metars.length > 0 ? metars[0] : null;
            if (!metar) {
              return null;
            }

            const parsed = parseMetarCeiling(metar);
            if (!parsed.usable) {
              return null;
            }

            const iata = (candidate.station.iataId || '').trim().toUpperCase();
            const stationCode = iata.length === 3 ? iata : null;
            return {
              feet: parsed.feet,
              kind: parsed.kind,
              stationCode,
              rank: ceilingKindRank(parsed.kind),
              distanceKm: candidate.distanceKm,
            };
          } catch {
            return null;
          }
        }),
      );

      const bestResult =
        metarResults
          .filter(
            (result): result is NonNullable<typeof result> => result !== null,
          )
          .sort((a, b) => {
            if (b.rank !== a.rank) {
              return b.rank - a.rank;
            }
            return a.distanceKm - b.distanceKm;
          })[0] ?? null;

      if (bestResult) {
        res.json({
          feet: bestResult.feet,
          stationCode: bestResult.stationCode,
          kind: bestResult.kind,
        });
        return;
      }

      res.json({
        feet: null,
        stationCode: null,
        kind: 'unavailable' as CeilingKind,
      });
    } catch {
      res.json({
        feet: null,
        stationCode: null,
        kind: 'unavailable' as CeilingKind,
      });
    }
  },
);
