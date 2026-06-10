import { onRequest } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import { applyCors, handleOptionsPreflight } from './http';

interface StationInfo {
  icaoId?: string;
  iataId?: string;
  lat?: number;
  lon?: number;
}

interface MetarCloudLayer {
  cover?: string;
  base?: number;
}

interface MetarRecord {
  cover?: string;
  clouds?: MetarCloudLayer[];
}

type CeilingKind = 'ceiling' | 'cloud-base' | 'above-threshold' | 'unavailable';

interface ParsedCeiling {
  feet: number | null;
  kind: CeilingKind;
  usable: boolean;
}

function ceilingKindRank(kind: CeilingKind): number {
  if (kind === 'ceiling') return 3;
  if (kind === 'cloud-base') return 2;
  if (kind === 'above-threshold') return 1;
  return 0;
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function parseMetarCeiling(metar: MetarRecord): ParsedCeiling {
  const cover = (metar?.cover || '').toUpperCase();
  const aboveThresholdCover = new Set(['CAVOK', 'CLR', 'SKC', 'NSC', 'NCD']);
  if (aboveThresholdCover.has(cover)) {
    return { feet: null, kind: 'above-threshold', usable: true };
  }

  const clouds = Array.isArray(metar?.clouds) ? metar.clouds : [];
  const ceilingLayers = clouds.filter((layer) => {
    const layerCover = (layer?.cover || '').toUpperCase();
    return layerCover === 'BKN' || layerCover === 'OVC' || layerCover === 'VV';
  });

  const ceilingBases = ceilingLayers
    .map((layer) => layer?.base)
    .filter((base): base is number => Number.isFinite(base));

  if (ceilingBases.length > 0) {
    return {
      feet: Math.round(Math.min(...ceilingBases)),
      kind: 'ceiling',
      usable: true,
    };
  }

  const nonCeilingBases = clouds
    .filter((layer) => {
      const layerCover = (layer?.cover || '').toUpperCase();
      return layerCover === 'FEW' || layerCover === 'SCT';
    })
    .map((layer) => layer?.base)
    .filter((base): base is number => Number.isFinite(base));

  if (nonCeilingBases.length > 0) {
    return {
      feet: Math.round(Math.min(...nonCeilingBases)),
      kind: 'cloud-base',
      usable: true,
    };
  }

  return { feet: null, kind: 'unavailable', usable: false };
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
