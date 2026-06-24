import type { WindowViewPlane } from '../../components/window-view-overlay/window-view-overlay.component';
import type { PlaneLogService } from '../plane-log.service';

export function updateWindowViewMarkers(ctx: PlaneLogService, windowViewPlanes: WindowViewPlane[]): void {
  const cones = [
    { label: 'Balcony', start: 75, end: 190 },
    { label: 'Streetside', start: 245, end: 345 },
  ];
  const home = ctx.settings.getHomeLocation();
  if (!home) return;
  const azToX = (az: number) => (((az + 180) % 360) / 360) * 100;
  const azToCompass = (az: number) => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round((az % 360) / 22.5) % 16];
  };
  const y = (10 / 12) * 70;
  const markers = cones.flatMap(({ label, start, end }) => {
    const mid = (start + end) / 2;
    return [
      { x: azToX(start), y, callsign: `${label} Start`, altitude: -1, isMarker: true, azimuth: start, compass: azToCompass(start), icao: `marker-${label}-start`, origin: '' },
      { x: azToX(mid), y, callsign: label, altitude: -1, isMarker: true, azimuth: mid, compass: azToCompass(mid), icao: `marker-${label}-mid`, origin: '' },
      { x: azToX(end), y, callsign: `${label} End`, altitude: -1, isMarker: true, azimuth: end, compass: azToCompass(end), icao: `marker-${label}-end`, origin: '' },
    ];
  });
  const mergedPlanes = [...windowViewPlanes.filter((p) => !p.isMarker), ...markers];
  if (ctx.windowViewOverlayComponent) ctx.windowViewOverlayComponent.windowViewPlanes = mergedPlanes;
  if (ctx.mapComponent) ctx.mapComponent.windowViewPlanes = mergedPlanes;
}
