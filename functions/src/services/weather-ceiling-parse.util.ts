export type CeilingKind = 'ceiling' | 'cloud-base' | 'above-threshold' | 'unavailable';

export interface MetarCloudLayer {
  cover?: string;
  base?: number;
}

export interface MetarRecord {
  cover?: string;
  clouds?: MetarCloudLayer[];
}

export interface ParsedCeiling {
  feet: number | null;
  kind: CeilingKind;
  usable: boolean;
}

export function ceilingKindRank(kind: CeilingKind): number {
  if (kind === 'ceiling') return 3;
  if (kind === 'cloud-base') return 2;
  if (kind === 'above-threshold') return 1;
  return 0;
}

export function distanceKm(
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

export function parseMetarCeiling(metar: MetarRecord): ParsedCeiling {
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
