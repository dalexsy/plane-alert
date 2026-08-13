import { adsbPointProxyUrl } from '../../config/planes-api.config';

let lastEmptyReportAt = 0;
const emptyReportMs = 10 * 60 * 1000;

function reportDeadFeed(err: unknown, extra: Record<string, unknown>): void {
  const report = (
    globalThis as unknown as {
      drylReportError?: (v: unknown, ctx?: object, level?: string) => void;
    }
  ).drylReportError;
  report?.(
    err instanceof Error ? err : new Error(String(err)),
    { source: 'adsbPointProxy', explicit: true, ...extra },
    'warn',
  );
}

export async function fetchPlaneDataFromApi(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      lat: String(centerLat),
      lon: String(centerLon),
      radiusKm: String(radiusKm),
    });
    const response = await fetch(`${adsbPointProxyUrl}?${params}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`adsbPointProxy HTTP ${response.status}: ${body.slice(0, 120)}`);
      throw new Error(`adsbPointProxy HTTP ${response.status}`);
    }
    const ac = (await response.json()).ac || [];
    if (!ac.length && Date.now() - lastEmptyReportAt > emptyReportMs) {
      lastEmptyReportAt = Date.now();
      reportDeadFeed(new Error('adsbPointProxy returned empty ac'), {
        centerLat,
        centerLon,
        radiusKm,
      });
    }
    return ac;
  } catch (err) {
    console.warn('ADS-B API unavailable, using cached aircraft data:', err);
    if (Date.now() - lastEmptyReportAt > emptyReportMs) {
      lastEmptyReportAt = Date.now();
      reportDeadFeed(err, { centerLat, centerLon, radiusKm });
    }
    return [];
  }
}
