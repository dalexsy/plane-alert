import { haversineDistance } from '../../utils/geo-utils';
import { toggleAirportColor } from './airport-toggle.util';
import type { AirportService } from '../airport.service';

export type Ctx = AirportService;

const MAJOR_AIRPORT_RADIUS_KM = 5;
const MINOR_AIRPORT_RADIUS_KM = 1;

export async function findAndDisplayAirports(
  ctx: Ctx,
  lat: number,
  lon: number,
  radiusKm: number,
  showLabels: boolean
): Promise<void> {
    // Check if location has meaningfully changed (>1km)
    const locationChanged =
      ctx.currentLat === null ||
      ctx.currentLon === null ||
      Math.abs(lat - ctx.currentLat) > 0.01 ||
      Math.abs(lon - ctx.currentLon) > 0.01;

    if (!locationChanged && ctx.airportCircles.size > 0) {
      // Same location, just update label visibility
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

    // Update current location
    ctx.currentLat = lat;
    ctx.currentLon = lon;

    // Clear existing airports from previous location
    ctx.airportCircles.forEach((circle) => circle.remove());
    ctx.airportCircles.clear();
    ctx.airportData.clear();
    // Keep clicked airports and radius cache for persistence

    try {
      // Track runway radius promises to delay spinner hiding
      const radiusPromises: Promise<void>[] = [];

      const radiusMeters = radiusKm * 1000;
      const overpassUrl = 'https://overpass-api.de/api/interpreter';

      // Query for nodes, ways, and relations tagged as aerodromes within the radius
      const query = `
        [out:json][timeout:25];
        (
          node["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
          way["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
          relation["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
        );
        out center;
      `;

      const response = await fetch(overpassUrl, {
        method: 'POST',
        body: query,
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

            // Store metadata
            ctx.airportData.set(airportId, { name, code });
            foundAirportIds.add(airportId);

            // Determine radius: use runway lengths if available, fallback to IATA presence
            const defaultKm = code
              ? MAJOR_AIRPORT_RADIUS_KM
              : MINOR_AIRPORT_RADIUS_KM;
            const useKm = ctx.airportRadiusCache.get(airportId) ?? defaultKm;

            // Check if circle already exists
            if (!ctx.airportCircles.has(airportId)) {
              // Determine initial color based on clicked state
              const isClicked = ctx.clickedAirports.has(airportId);
              const circleColor = isClicked ? 'gold' : 'cyan';
              const fillPattern = isClicked
                ? 'url(#airportStripedPatternGold)'
                : 'url(#airportStripedPatternCyan)';

              const circle = L.circle([airportLat, airportLon], {
                radius: useKm * 1000,
                color: circleColor,
                weight: 2,
                fill: true,
                fillColor: fillPattern,
                fillOpacity: 0.3,
                className: 'airport-radius',
                interactive: true,
              }).addTo(ctx.map);

              // Add click event handler to toggle color
              circle.on('click', () => {
                toggleAirportColor(ctx, airportId);
              });

              // Hover effects now handled by CSS :hover pseudo-class
              // circle.on('mouseover', () => {
              //   circle.setStyle({ fillOpacity: 0.7 });
              // });
              // circle.on('mouseout', () => {
              //   circle.setStyle({ fillOpacity: 0.3 });
              // });

              // Always bind tooltip; use `permanent` to show/hide labels
              circle.bindTooltip(name, {
                direction: 'center',
                className: 'airport-tooltip',
                opacity: 0.8,
                offset: [0, 0],
                permanent: showLabels,
              });

              ctx.airportCircles.set(airportId, circle);

              // Use default radius until bulk runway query updates it
              if (!ctx.airportRadiusCache.has(airportId)) {
                ctx.airportRadiusCache.set(airportId, defaultKm);
              }
            } else {
              // Update existing circle color based on clicked state
              const existingCircle = ctx.airportCircles.get(airportId);
              if (existingCircle) {
                const isClicked = ctx.clickedAirports.has(airportId);
                const circleColor = isClicked ? 'gold' : 'cyan';
                const fillPattern = isClicked
                  ? 'url(#airportStripedPatternGold)'
                  : 'url(#airportStripedPatternCyan)';
                existingCircle.setStyle({
                  color: circleColor,
                  fillColor: fillPattern,
                });
              }
            }
          }
        }
      }

      // Remove circles for airports no longer in the result set
      ctx.airportCircles.forEach((circle, id) => {
        if (!foundAirportIds.has(id)) {
          circle.remove();
          ctx.airportCircles.delete(id);
          ctx.airportData.delete(id);
          ctx.clickedAirports.delete(id);
        }
      });

      // Bulk fetch runway data for all airports at once
      if (ctx.airportCircles.size > 0) {
        const airportList = Array.from(ctx.airportCircles.entries()).map(
          ([id, circle]) => ({
            id,
            lat: circle.getLatLng().lat,
            lon: circle.getLatLng().lng,
            hasIata: !!ctx.airportData.get(id)?.code,
          })
        );

        // Compute bbox covering all airports plus margin
        const lats = airportList.map((a) => a.lat);
        const lons = airportList.map((a) => a.lon);
        const minLat = Math.min(...lats) - radiusKm / 111;
        const maxLat = Math.max(...lats) + radiusKm / 111;
        const minLon = Math.min(...lons) - radiusKm / 111;
        const maxLon = Math.max(...lons) + radiusKm / 111;

        const runwayQuery = `
          [out:json][timeout:25];
          (
            way["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
            node["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out geom;
        `;

        const runwayPromise = fetch(overpassUrl, {
          method: 'POST',
          body: runwayQuery,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.elements) return;

            const lengthsByAirport = new Map<number, number>();
            data.elements.forEach((elem: any) => {
              const coords = elem.geometry;
              if (!coords || coords.length < 2) return;

              // Compute runway length between first and last point
              const start = coords[0];
              const end = coords[coords.length - 1];
              const lenKm = haversineDistance(
                start.lat,
                start.lon,
                end.lat,
                end.lon
              );

              // Find nearest airport center
              let bestId = null;
              let bestDist = Infinity;
              airportList.forEach((a) => {
                const d = haversineDistance(
                  a.lat,
                  a.lon,
                  (start.lat + end.lat) / 2,
                  (start.lon + end.lon) / 2
                );
                if (d < bestDist) {
                  bestDist = d;
                  bestId = a.id;
                }
              });

              if (bestId != null) {
                const prev = lengthsByAirport.get(bestId) || 0;
                lengthsByAirport.set(bestId, Math.max(prev, lenKm));
              }
            });

            // Apply computed radii
            airportList.forEach((a) => {
              const circle = ctx.airportCircles.get(a.id);
              const maxLen = lengthsByAirport.get(a.id) || 0;
              const radius =
                maxLen > 0
                  ? maxLen / 2 + 0.5
                  : a.hasIata
                  ? MAJOR_AIRPORT_RADIUS_KM
                  : MINOR_AIRPORT_RADIUS_KM;
              ctx.airportRadiusCache.set(a.id, radius);
              if (circle) circle.setRadius(radius * 1000);
            });
          })
          .catch(() => {});

        radiusPromises.push(runwayPromise);
      }

      // Wait for all runway radius updates before hiding spinner
      await Promise.all(radiusPromises);

      // Increase opacity of all airport circles after resizing
      ctx.airportCircles.forEach((circle) =>
        circle.setStyle({ fillOpacity: 0.3 })
      );

      // Hide loading indicator inside Angular zone
      ctx.ngZone.run(() => {
        ctx.loadingAirports = false;
      });
    } catch (error) {
      // Hide loading indicator on error
      ctx.ngZone.run(() => {
        ctx.loadingAirports = false;
      });
    } finally {
      ctx.airportsLoading = false;
    }
}
