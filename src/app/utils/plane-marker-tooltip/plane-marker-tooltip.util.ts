import * as L from 'leaflet';
import { isKioskMode } from '../kiosk-mode/kiosk-mode.util';

export function manageMarkerZIndex(markerInstance: L.Marker, bringForward: boolean): void {
  const offset = bringForward ? 10000 : 0;
  const tooltipZIndex = bringForward ? '20000' : '';
  markerInstance.setZIndexOffset(offset);
  const tooltipEl = markerInstance.getTooltip()?.getElement();
  if (tooltipEl) tooltipEl.style.zIndex = tooltipZIndex;
  const leftMarker = (markerInstance as any).__leftMarker as L.Marker | undefined;
  if (leftMarker) {
    leftMarker.setZIndexOffset(offset);
    const leftTooltipEl = leftMarker.getTooltip()?.getElement();
    if (leftTooltipEl) leftTooltipEl.style.zIndex = tooltipZIndex;
  }
}

export function removeLeftMarker(markerInstance: L.Marker, map: L.Map): void {
  const leftMarker = (markerInstance as any).__leftMarker as L.Marker | undefined;
  const syncFn = (markerInstance as any).__syncLeftMarker as (() => void) | undefined;
  if (leftMarker) {
    map.removeLayer(leftMarker);
    delete (markerInstance as any).__leftMarker;
  }
  if (syncFn) {
    markerInstance.off('move', syncFn);
    delete (markerInstance as any).__syncLeftMarker;
  }
}

export function createLeftMarker(
  markerInstance: L.Marker,
  map: L.Map,
  leftTooltipContent: string,
  leftTooltipOptions: L.TooltipOptions
): L.Marker | null {
  // Second permanent tooltip + move-sync is pure paint/DOM tax on the wall display.
  if (isKioskMode()) {
    return null;
  }
  if (!map.hasLayer(markerInstance)) return null;
  removeLeftMarker(markerInstance, map);
  const invisibleIcon = L.divIcon({ className: 'invisible-marker', html: '', iconSize: [1, 1] });
  const leftMarker = L.marker(markerInstance.getLatLng(), { icon: invisibleIcon });
  leftMarker.bindTooltip(leftTooltipContent, leftTooltipOptions);
  leftMarker.addTo(map);
  (markerInstance as any).__leftMarker = leftMarker;
  const syncPosition = () => leftMarker.setLatLng(markerInstance.getLatLng());
  markerInstance.on('move', syncPosition);
  (markerInstance as any).__syncLeftMarker = syncPosition;
  return leftMarker;
}

export function wireMarkerHoverEvents(marker: L.Marker): void {
  if ((marker as any).__paHoverWired) {
    return;
  }
  (marker as any).__paHoverWired = true;
  const bringForwardHandler = () => manageMarkerZIndex(marker, true);
  const sendBackwardHandler = () => manageMarkerZIndex(marker, false);
  marker.on('mouseover', bringForwardHandler);
  marker.on('mouseout', sendBackwardHandler);
  marker.on('tooltipopen', () => {
    const tooltipEl = marker.getTooltip()?.getElement();
    if (!tooltipEl) return;
    tooltipEl.addEventListener('mouseenter', bringForwardHandler);
    tooltipEl.addEventListener('mouseleave', sendBackwardHandler);
    tooltipEl.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.callsign-text')) return;
      const wrapperEl = (e.target as HTMLElement).closest('.tooltip-follow-wrapper');
      if (!wrapperEl) return;
      e.stopPropagation();
      e.preventDefault();
      const icao = wrapperEl.getAttribute('data-icao');
      if (icao) window.dispatchEvent(new CustomEvent('plane-tooltip-follow', { detail: { icao } }));
    });
  });
  marker.on('tooltipclose', () => {
    const tooltipEl = marker.getTooltip()?.getElement();
    if (tooltipEl) {
      tooltipEl.removeEventListener('mouseenter', bringForwardHandler);
      tooltipEl.removeEventListener('mouseleave', sendBackwardHandler);
    }
  });
}

export function buildTooltipOptions(
  side: 'left' | 'right',
  isGrounded: boolean,
  isNew: boolean,
  isMilitary: boolean,
  isSpecial: boolean,
  followed: boolean,
  operatorClasses: string,
  militaryAlertWorthy = true,
): L.TooltipOptions {
  const offset =
    side === 'right'
      ? isGrounded
        ? L.point(-10, 0)
        : L.point(10, 0)
      : isGrounded
        ? L.point(10, 0)
        : L.point(-10, 0);
  const milClass = isMilitary
    ? militaryAlertWorthy
      ? 'military-plane-tooltip'
      : 'military-plane-tooltip military-muted-tooltip'
    : '';
  return {
    permanent: true,
    direction: side,
    offset,
    interactive: side === 'right',
    className: `plane-tooltip ${isGrounded ? 'grounded-plane-tooltip' : ''} ${
      isNew ? 'new-plane-tooltip' : ''
    } ${milClass} ${isSpecial ? 'special-plane-tooltip' : ''}${
      followed ? ' followed-plane-tooltip' : ''
    } ${operatorClasses}`,
    pane: 'tooltipPane',
  };
}

/** Stable key so callers can skip unbind/rebind when nothing changed. */
export function tooltipBindKey(
  content: string,
  options: L.TooltipOptions
): string {
  return `${content}\0${options.className ?? ''}\0${options.permanent ? 1 : 0}\0${options.direction ?? ''}`;
}

/** Rebind right tooltip only when content/options actually changed. */
export function applyRightTooltipIfChanged(
  markerInstance: L.Marker,
  content: string,
  options: L.TooltipOptions
): void {
  const key = tooltipBindKey(content, options);
  const prevKey = (markerInstance as any).__paTipKey as string | undefined;
  if (prevKey === key && markerInstance.getTooltip()) {
    return;
  }
  if (markerInstance.getTooltip()) {
    markerInstance.unbindTooltip();
  }
  markerInstance.bindTooltip(content, options);
  (markerInstance as any).__paTipKey = key;
}

/** Create/update/remove left operator tooltip only when content/options changed. */
export function syncLeftTooltipIfChanged(
  markerInstance: L.Marker,
  map: L.Map,
  leftTooltipContent: string,
  leftTooltipOptions: L.TooltipOptions
): void {
  if (!leftTooltipContent || leftTooltipContent === '&nbsp;') {
    removeLeftMarker(markerInstance, map);
    delete (markerInstance as any).__paLeftTipKey;
    return;
  }
  const leftKey = tooltipBindKey(leftTooltipContent, leftTooltipOptions);
  const prevLeft = (markerInstance as any).__paLeftTipKey as string | undefined;
  if (prevLeft === leftKey && (markerInstance as any).__leftMarker) {
    return;
  }
  createLeftMarker(markerInstance, map, leftTooltipContent, leftTooltipOptions);
  (markerInstance as any).__paLeftTipKey = leftKey;
}
