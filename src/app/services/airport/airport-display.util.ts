import {
  addAirportCircle,
  applyRunwayRadii,
  buildAerodromeQuery,
  MAJOR_AIRPORT_RADIUS_KM,
  MINOR_AIRPORT_RADIUS_KM,
  type AirportDisplayCtx,
} from './airport-circle-render.util';

export type Ctx = AirportDisplayCtx;

export async function findAndDisplayAirports(
  ctx: Ctx,
  lat: number,
  lon: number,
  radiusKm: number,
  showLabels: boolean,
): Promise<void> {
  const locationChanged =
    ctx.currentLat === null ||
    ctx.currentLon === null ||
    Math.abs(lat - ctx.currentLat) > 0.01 ||
    Math.abs(lon - ctx.currentLon) > 0.01;

  if (!locationChanged && ctx.airportCircles.size > 0) {
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
  ctx.airportCircles.forEach((circle) => circle.remove());
  ctx.airportCircles.clear();
  ctx.airportData.clear();

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: buildAerodromeQuery(radiusKm * 1000, lat, lon),
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = await response.json();
    const foundAirportIds = new Set<number>();

    for (const element of data.elements || []) {
      if (element.type === 'node' || element.center) {
        const airportLat = element.lat ?? element.center?.lat;
        const airportLon = element.lon ?? element.center?.lon;
        const airportId = element.id;

        if (airportLat !== undefined && airportLon !== undefined) {
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
    ctx.ngZone.run(() => {
      ctx.loadingAirports = false;
    });
  } catch {
    ctx.ngZone.run(() => {
      ctx.loadingAirports = false;
    });
  } finally {
    ctx.airportsLoading = false;
  }
}
