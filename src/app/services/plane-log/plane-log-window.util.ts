import type { WindowViewPlane } from '../../components/window-view-overlay/window-view-overlay.component';
import { computeWindowHistoryPositions } from '../../utils/window-history-trail-utils/window-history-trail-utils';
import { getIconPathForModel } from '../../utils/plane-icons/plane-icons';
import { calculateVerticalRateFromHistory } from '../../utils/vertical-rate/vertical-rate.util';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import type { PlaneModel } from '../../models/plane-model';
import type { PlaneLogService } from './plane-log.service';
import { computeBearing } from './plane-log-geo.util';
import { updateWindowViewMarkers } from './plane-log-markers.util';

export function updateWindowViewPlanes(
  ctx: PlaneLogService,
  visiblePlanes: PlaneModel[],
  centerLat: number,
  centerLon: number
): WindowViewPlane[] {
  const windowViewPlanes = visiblePlanes
    .filter((p) => (p.altitude ?? 0) > 0 || p.onGround)
    .map((plane) => {
      const isGrounded = !!plane.onGround;
      const azimuth = computeBearing(
        ctx.settings.lat ?? 52.3667,
        ctx.settings.lon ?? 13.5033,
        plane.lat!,
        plane.lon!
      );
      const x = ((azimuth + 180) % 360 / 360) * 100;
      const alt = isGrounded ? 0 : plane.altitude ?? 0;
      const y = (Math.min(alt, 20000) / 20000) * 100;
      const isHelicopter = ctx.helicopterIdentificationService.isHelicopter(
        plane.icao, plane.model, plane.operator, plane.callsign, plane.icaoType
      );
      const iconData = getIconPathForModel(plane.model, plane.callsign, alt, isHelicopter, {
        icaoType: plane.icaoType, category: plane.category,
      });
      const distKm = haversineDistance(centerLat, centerLon, plane.lat!, plane.lon!);
      const maxRadius = ctx.settings.radius ?? 5;
      const isMobile = window.innerWidth < 600;
      let scale = 1.0;
      if (distKm <= 10) {
        const normalizedDistance = distKm / 10;
        const exponentialCurve = Math.pow(normalizedDistance, 1.5);
        scale = isMobile ? Math.max(0.6, 0.6 + exponentialCurve * 0.4) : Math.max(1.0, 3.0 - exponentialCurve * 2.0);
      } else {
        const beyondNormalized = Math.min((distKm - 10) / (maxRadius - 10), 1);
        scale = Math.max(0.5, 1.0 - beyondNormalized * 0.5);
      }
      const rawHistory = computeWindowHistoryPositions(plane.positionHistory, centerLat, centerLon);
      const historyTrail = rawHistory.map((hp, idx, arr) => ({
        x: hp.x,
        y: hp.y,
        opacity: 0.1 + (0.9 * idx) / (arr.length - 1 || 1),
      }));
      const lastTrail = historyTrail[historyTrail.length - 1];
      if (
        !lastTrail ||
        Math.abs(lastTrail.x - x) > 0.01 ||
        Math.abs(lastTrail.y - y) > 0.01
      ) {
        historyTrail.push({ x, y, opacity: 1 });
      }
      return {
        x, y, callsign: plane.callsign || '', altitude: alt, lat: plane.lat!, lon: plane.lon!,
        bearing: plane.track ?? 0, iconPath: iconData.path, iconType: iconData.iconType,
        isHelicopter,
        velocity: plane.velocity ?? 0,
        verticalRate: plane.verticalRate ?? calculateVerticalRateFromHistory(plane.positionHistory) ?? undefined,
        historyTrail, scale, distanceKm: distKm, isNew: plane.isNew, isMilitary: plane.isMilitary,
        isMilitaryAlertWorthy: plane.isMilitaryAlertWorthy,
        isSpecial: plane.isSpecial, icao: plane.icao, origin: plane.origin, isGrounded,
        operator: plane.operator, model: plane.model,
      };
    });
  updateWindowViewMarkers(ctx, windowViewPlanes);
  return windowViewPlanes;
}
