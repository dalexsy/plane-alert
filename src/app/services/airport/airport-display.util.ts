import {
  addAirportCircle,
  applyRunwayRadii,
  buildAerodromeQuery,
  MAJOR_AIRPORT_RADIUS_KM,
  MINOR_AIRPORT_RADIUS_KM,
  type AirportDisplayCtx,
} from './airport-circle-render.util';
import { fetchOverpassJson } from './overpass-fetch.util';

export type Ctx = AirportDisplayCtx;

const RETRY_DELAY_MS = 8_000;
const MAX_BG_RETRIES = 3;

function clearAirports(ctx: Ctx): void {
  ctx.airportCircles.forEach((circle) => circle.remove());
  ctx.airportCircles.clear();
  ctx.airportData.clear();
}

function scheduleAirportRetry(
  ctx: Ctx,
  lat: number,
  lon: number,
  radiusKm: number,
  showLabels: boolean,
): void {
  if (ctx.airportRetryTimer != null || ctx.airportBgRetries >= MAX_BG_RETRIES) {
    return;
  }
  ctx.airportBgRetries += 1;
  ctx.airportRetryTimer = setTimeout(() => {
    ctx.airportRetryTimer = null;
    void findAndDisplayAirports(ctx, lat, lon, radiusKm, showLabels, true);
  }, RETRY_DELAY_MS);
}

export async function findAndDisplayAirports(
  ctx: Ctx,
  lat: number,
  lon: number,
  radiusKm: number,
  showLabels: boolean,
  force = false,
): Promise<void> {
  const locationChanged =
    ctx.currentLat === null ||
    ctx.currentLon === null ||
    Math.abs(lat - ctx.currentLat) > 0.01 ||
    Math.abs(lon - ctx.currentLon) > 0.01;

  if (!force && !locationChanged && ctx.airportCircles.size > 0) {
    ctx.updateAirportLabels(showLabels);
    return;
  }

  if (ctx.airportsLoading) {
    return;
  }
  ctx.airportsLoading = true;
  ctx.ngZone.run(() => {
    ctx.loadingAirports = true;
  });

  ctx.currentLat = lat;
  ctx.currentLon = lon;
  if (locationChanged && !force) {
    ctx.airportBgRetries = 0;
  }

  try {
    const data = await fetchOverpassJson(
      buildAerodromeQuery(radiusKm * 1000, lat, lon),
    );
    ctx.airportBgRetries = 0;
    clearAirports(ctx);
    const foundAirportIds = new Set<number>();

    for (const element of (data.elements || []) as Array<{
      type?: string;
      center?: { lat: number; lon: number };
      lat?: number;
      lon?: number;
      id: number;
      tags?: { name?: string; iata?: string };
    }>) {
      if (element.type !== 'node' && !element.center) {
        continue;
      }
      const airportLat = element.lat ?? element.center?.lat;
      const airportLon = element.lon ?? element.center?.lon;
      const airportId = element.id;
      if (airportLat === undefined || airportLon === undefined) {
        continue;
      }

      const name = element.tags?.['name'] || 'Unknown Airport';
      const code = element.tags?.['iata'] || '';
      ctx.airportData.set(airportId, { name, code });
      foundAirportIds.add(airportId);

      const defaultKm = code ? MAJOR_AIRPORT_RADIUS_KM : MINOR_AIRPORT_RADIUS_KM;
      const useKm = ctx.airportRadiusCache.get(airportId) ?? defaultKm;

      if (!ctx.airportCircles.has(airportId)) {
        addAirportCircle(
          ctx,
          airportId,
          airportLat,
          airportLon,
          name,
          code,
          showLabels,
          useKm,
        );
      } else {
        const existingCircle = ctx.airportCircles.get(airportId);
        if (existingCircle) {
          const isClicked = ctx.clickedAirports.has(airportId);
          existingCircle.setStyle({
            color: isClicked ? 'gold' : 'cyan',
            fillColor: isClicked
              ? 'url(#airportStripedPatternGold)'
              : 'url(#airportStripedPatternCyan)',
          });
        }
      }
    }

    ctx.airportCircles.forEach((circle, id) => {
      if (!foundAirportIds.has(id)) {
        circle.remove();
        ctx.airportCircles.delete(id);
        ctx.airportData.delete(id);
        ctx.clickedAirports.delete(id);
      }
    });

    await applyRunwayRadii(ctx, radiusKm).catch(() => undefined);

    ctx.airportCircles.forEach((circle) =>
      circle.setStyle({ fillOpacity: 0.3 }),
    );
  } catch {
    scheduleAirportRetry(ctx, lat, lon, radiusKm, showLabels);
  } finally {
    ctx.ngZone.run(() => {
      ctx.loadingAirports = false;
    });
    ctx.airportsLoading = false;
  }
}
