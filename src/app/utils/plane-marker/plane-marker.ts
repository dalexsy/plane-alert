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
  tooltipBindKey,
  wireMarkerHoverEvents,
} from '../plane-marker-tooltip/plane-marker-tooltip.util';
import {
  removeGhostMarkerFromPlane,
  updateGhostMarker,
} from './plane-marker-ghost.util';
import { isKioskMode } from '../kiosk-mode/kiosk-mode.util';

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
    followed,
    animationsEnabled,
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
    !isKioskMode() && operatorTooltipService && planeData
      ? operatorTooltipService.getLeftTooltipContent(planeData)
      : '&nbsp;';
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
  const rightTipKey = tooltipBindKey(tooltipContent, rightTooltipOptions);

  const syncLeftTooltip = (markerInstance: L.Marker) => {
    if (leftTooltipContent && leftTooltipContent !== '&nbsp;') {
      const prevLeft = (markerInstance as any).__paLeftTipKey as string | undefined;
      const leftKey = tooltipBindKey(leftTooltipContent, leftTooltipOptions);
      if (prevLeft === leftKey && (markerInstance as any).__leftMarker) {
        return;
      }
      createLeftMarker(markerInstance, map, leftTooltipContent, leftTooltipOptions);
      (markerInstance as any).__paLeftTipKey = leftKey;
    } else {
      removeLeftMarker(markerInstance, map);
      delete (markerInstance as any).__paLeftTipKey;
    }
  };

  const applyRightTooltip = (markerInstance: L.Marker) => {
    const prevKey = (markerInstance as any).__paTipKey as string | undefined;
    if (prevKey === rightTipKey && markerInstance.getTooltip()) {
      return;
    }
    if (markerInstance.getTooltip()) {
      markerInstance.unbindTooltip();
    }
    markerInstance.bindTooltip(tooltipContent, rightTooltipOptions);
    (markerInstance as any).__paTipKey = rightTipKey;
  };

  if (oldMarker) {
    const currentLatLng = oldMarker.getLatLng();
    const newLatLng = L.latLng(lat, lon);
    const prevAdsB = (oldMarker as any).__paLastAdsB as
      | { lat: number; lon: number }
      | undefined;
    const leafletMoved =
      Math.abs(currentLatLng.lat - lat) > 0.000001 ||
      Math.abs(currentLatLng.lng - lon) > 0.000001;
    const adsBMoved =
      !!prevAdsB &&
      (Math.abs(prevAdsB.lat - lat) > 0.00005 ||
        Math.abs(prevAdsB.lon - lon) > 0.00005);
    const hasPositionChanged = leafletMoved || adsBMoved;
    (oldMarker as any).__paLastAdsB = { lat, lon };

    // Onion-skin stays at previous ADS-B fix for the whole scan interval
    if (showGhostPosition && prevAdsB && adsBMoved) {
      updateGhostMarker(
        oldMarker,
        map,
        prevAdsB.lat,
        prevAdsB.lon,
        true,
        true,
        ghostMarkerHtml
      );
    } else if (!showGhostPosition) {
      updateGhostMarker(oldMarker, map, lat, lon, false, false, ghostMarkerHtml);
    }

    if (hasPositionChanged && animationsEnabled) {
      const animationDuration = Math.max(2, scanInterval * 0.95) * 1000;
      smoothLerpMarkerToPosition(oldMarker, currentLatLng, newLatLng, animationDuration);
    } else if (hasPositionChanged) {
      oldMarker.setLatLng([lat, lon]);
    }

    const prevHtml = (oldMarker as any).__paMarkerHtml as string | undefined;
    if (prevHtml !== markerHtml) {
      oldMarker.setIcon(icon);
      (oldMarker as any).__paMarkerHtml = markerHtml;
    }
    oldMarker.setZIndexOffset(followed ? 10000 : 0);
    applyRightTooltip(oldMarker);
    syncLeftTooltip(oldMarker);
    wireMarkerHoverEvents(oldMarker);
    return { marker: oldMarker, isNewMarker: false };
  }

  const marker = L.marker([lat, lon], { icon });
  (marker as any).__paLastAdsB = { lat, lon };
  (marker as any).__paMarkerHtml = markerHtml;
  marker.bindTooltip(tooltipContent, rightTooltipOptions);
  (marker as any).__paTipKey = rightTipKey;
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
