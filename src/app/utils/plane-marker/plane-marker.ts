/* src/app/utils/plane-marker/plane-marker.ts */
import * as L from 'leaflet';
import { getIconPathForModel } from '../plane-icons/plane-icons';
import { OperatorTooltipService } from '../../services/operator-tooltip/operator-tooltip.service';
import { smoothLerpMarkerToPosition } from '../plane-marker-animation/plane-marker-animation.util';
import { buildPlaneMarkerClassString, computePlaneShadowStyle } from '../plane-marker-style/plane-marker-style.util';
import {
  buildTooltipOptions,
  createLeftMarker,
  removeLeftMarker,
  wireMarkerHoverEvents,
} from '../plane-marker-tooltip/plane-marker-tooltip.util';
import {
  removeGhostMarkerFromPlane,
  updateGhostMarker,
} from './plane-marker-ghost.util';

export { removeGhostMarkerFromPlane } from './plane-marker-ghost.util';

export function createOrUpdatePlaneMarker(
  oldMarker: L.Marker | undefined,
  map: L.Map,
  lat: number,
  lon: number,
  rotation: number,
  extraStyle: string,
  isNew: boolean,
  isGrounded: boolean,
  tooltipContent: string,
  planeIcon: string = '',
  isMilitary: boolean = false,
  model: string = '',
  isCustomHelicopter: boolean = false,
  isSpecial: boolean = false,
  isUnknown: boolean = false,
  altitude: number | null = null,
  followed: boolean = false,
  scanInterval: number = 10,
  icao: string = '',
  callsign: string = '',
  operatorTooltipService?: OperatorTooltipService,
  planeData?: any,
  animationsEnabled: boolean = true,
  showGhostPosition: boolean = false
): { marker: L.Marker; isNewMarker: boolean } {
  const isCopter = isCustomHelicopter;
  const iconData = isCopter
    ? { path: '', iconType: 'helicopter' as const }
    : getIconPathForModel(model, callsign, altitude || undefined, isCopter);
  const iconInner =
    !isCopter && !isUnknown
      ? `<svg class="inline-plane ${iconData.iconType}" viewBox="0 0 64 64"><path d="${iconData.path}"/></svg>`
      : '';
  const shadowStyle = computePlaneShadowStyle(lat, lon, rotation, isCopter, isGrounded, altitude);
  const classString = buildPlaneMarkerClassString(
    isCopter,
    isUnknown,
    iconData.iconType,
    isNew,
    isGrounded,
    isMilitary,
    followed
  );
  const markerHtml = `<div class="${classString}" style="transform: rotate(${
    isCopter ? 0 : rotation
  }deg); ${extraStyle} ${shadowStyle}">${iconInner}</div>`;
  const ghostMarkerHtml = `<div class="${classString} ghost-plane-marker" style="transform: rotate(${
    isCopter ? 0 : rotation
  }deg); ${extraStyle} ${shadowStyle}">${iconInner}</div>`;
  const icon = L.divIcon({
    className: 'plane-marker-container',
    html: markerHtml,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  const leftTooltipContent =
    operatorTooltipService && planeData ? operatorTooltipService.getLeftTooltipContent(planeData) : '&nbsp;';
  const operatorClasses =
    operatorTooltipService && planeData ? operatorTooltipService.getTooltipClasses(planeData) : '';
  const rightTooltipOptions = buildTooltipOptions(
    'right',
    isGrounded,
    isNew,
    isMilitary,
    isSpecial,
    followed,
    operatorClasses
  );
  const leftTooltipOptions = buildTooltipOptions(
    'left',
    isGrounded,
    isNew,
    isMilitary,
    isSpecial,
    followed,
    operatorClasses
  );

  const syncLeftTooltip = (markerInstance: L.Marker) => {
    if (leftTooltipContent && leftTooltipContent !== '&nbsp;') {
      createLeftMarker(markerInstance, map, leftTooltipContent, leftTooltipOptions);
    } else {
      removeLeftMarker(markerInstance, map);
    }
  };

  if (oldMarker) {
    const currentLatLng = oldMarker.getLatLng();
    const newLatLng = L.latLng(lat, lon);
    const hasPositionChanged =
      Math.abs(currentLatLng.lat - lat) > 0.000001 ||
      Math.abs(currentLatLng.lng - lon) > 0.000001;
    const prevAdsB = (oldMarker as any).__paLastAdsB as
      | { lat: number; lon: number }
      | undefined;
    (oldMarker as any).__paLastAdsB = { lat, lon };

    if (hasPositionChanged && animationsEnabled) {
      const ghostLat = prevAdsB?.lat ?? currentLatLng.lat;
      const ghostLon = prevAdsB?.lon ?? currentLatLng.lng;
      updateGhostMarker(
        oldMarker,
        map,
        ghostLat,
        ghostLon,
        showGhostPosition,
        true,
        ghostMarkerHtml
      );
      const animationDuration = Math.max(2, scanInterval * 0.95) * 1000;
      smoothLerpMarkerToPosition(oldMarker, currentLatLng, newLatLng, animationDuration);
    } else {
      updateGhostMarker(oldMarker, map, lat, lon, false, false, ghostMarkerHtml);
      oldMarker.setLatLng([lat, lon]);
    }
    oldMarker.setIcon(icon);
    oldMarker.setZIndexOffset(followed ? 10000 : 0);
    if (oldMarker.getTooltip()) oldMarker.unbindTooltip();
    oldMarker.bindTooltip(tooltipContent, rightTooltipOptions);
    syncLeftTooltip(oldMarker);
    wireMarkerHoverEvents(oldMarker);
    return { marker: oldMarker, isNewMarker: false };
  }

  const marker = L.marker([lat, lon], { icon });
  (marker as any).__paLastAdsB = { lat, lon };
  marker.bindTooltip(tooltipContent, rightTooltipOptions);
  marker.addTo(map);
  if (altitude != null) {
    const tooltipEl = marker.getTooltip()?.getElement();
    if (tooltipEl) tooltipEl.classList.add('altitude-bordered-tooltip');
  }
  syncLeftTooltip(marker);
  wireMarkerHoverEvents(marker);
  return { marker, isNewMarker: true };
}

export function removeLeftMarkerFromPlane(marker: L.Marker, map: L.Map): void {
  removeLeftMarker(marker, map);
  removeGhostMarkerFromPlane(marker, map);
}
