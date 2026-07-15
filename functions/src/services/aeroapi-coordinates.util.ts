import { reverseGeocode } from './geocoding';
import type { AirportInfo, FlightData } from './aeroapi.types';

export type AirportInfoWithCoord = AirportInfo & { _rawCoordCode?: string };

export function looksLikeCoordinate(code: string): boolean {
  if (!code) return false;
  const raw = code.trim();
  if (!raw) return false;
  const c = raw.toUpperCase().replace(/\s+/g, '');
  if (/^\d{4}[NS]\d{5}[EW]$/.test(c)) return true;
  if (/^[NS]\d{4,6}[EW]\d{4,6}$/.test(c)) return true;
  if (/^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(c)) return true;
  // Decimal pair with comma/slash/space
  if (/^-?\d{1,3}\.\d+[,\/\s]\s*-?\d{1,3}\.\d+$/.test(raw.trim())) return true;
  // Degree symbols: 52°31'N 13°24'E
  if (/\d{1,3}\s*°/.test(raw) && /[NS]/i.test(raw) && /[EW]/i.test(raw)) {
    return true;
  }
  return false;
}

export function parseCoordinateCode(
  code: string,
): { lat: number; lon: number } | null {
  const c = code.trim().toUpperCase();

  const arinc = c.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
  if (arinc) {
    const latDeg = parseInt(arinc[1], 10) + parseInt(arinc[2], 10) / 60;
    const lonDeg = parseInt(arinc[4], 10) + parseInt(arinc[5], 10) / 60;
    return {
      lat: arinc[3] === 'S' ? -latDeg : latDeg,
      lon: arinc[6] === 'W' ? -lonDeg : lonDeg,
    };
  }

  const nsew = c.match(/^([NS])(\d{2})(\d{2})([EW])(\d{3})(\d{2})$/);
  if (nsew) {
    const latDeg = parseInt(nsew[2], 10) + parseInt(nsew[3], 10) / 60;
    const lonDeg = parseInt(nsew[5], 10) + parseInt(nsew[6], 10) / 60;
    return {
      lat: nsew[1] === 'S' ? -latDeg : latDeg,
      lon: nsew[4] === 'W' ? -lonDeg : lonDeg,
    };
  }

  const faa = c.match(/^(\d{2,4})([NS])\/(\d{3,5})([EW])$/);
  if (faa) {
    const rawLat = faa[1].padStart(4, '0');
    const rawLon = faa[3].padStart(5, '0');
    const latDeg = parseInt(rawLat.slice(0, 2), 10) + parseInt(rawLat.slice(2), 10) / 60;
    const lonDeg = parseInt(rawLon.slice(0, 3), 10) + parseInt(rawLon.slice(3), 10) / 60;
    return {
      lat: faa[2] === 'S' ? -latDeg : latDeg,
      lon: faa[4] === 'W' ? -lonDeg : lonDeg,
    };
  }

  const decimal = c.match(/^(-?\d{1,3}\.\d+)[,\/ ]\s*(-?\d{1,3}\.\d+)$/);
  if (decimal) {
    return {
      lat: parseFloat(decimal[1]),
      lon: parseFloat(decimal[2]),
    };
  }

  return null;
}

export function normalizeAirportEndpoint(
  endpoint?: AeroApiResponseEndpoint,
): AirportInfoWithCoord | undefined {
  if (!endpoint) return undefined;
  const rawCode = endpoint.code_icao || endpoint.code || '';
  const isCoord = looksLikeCoordinate(rawCode);
  return {
    code: isCoord ? '' : rawCode,
    codeIcao: isCoord ? undefined : endpoint.code_icao,
    codeIata: isCoord ? undefined : endpoint.code_iata,
    name: endpoint.name,
    city: endpoint.city,
    timezone: endpoint.timezone,
    _rawCoordCode: isCoord ? rawCode : undefined,
  };
}

type AeroApiResponseEndpoint = {
  code?: string;
  code_icao?: string;
  code_iata?: string;
  name?: string;
  city?: string;
  timezone?: string;
};

export async function resolveCoordinateEndpoints(
  flightData: FlightData,
): Promise<void> {
  const endpoints = [flightData.origin, flightData.destination] as Array<
    AirportInfoWithCoord | undefined
  >;

  await Promise.all(
    endpoints.map(async (endpoint) => {
      if (!endpoint?._rawCoordCode) return;
      const coords = parseCoordinateCode(endpoint._rawCoordCode);
      if (!coords) return;

      const placeName = await reverseGeocode(coords.lat, coords.lon);
      if (placeName) {
        endpoint.city = placeName;
        endpoint.name = placeName;
      }
      delete endpoint._rawCoordCode;
    }),
  );
}