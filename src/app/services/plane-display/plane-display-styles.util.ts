import * as L from 'leaflet';
import type { PlaneModel } from '../../models/plane-model';

export function resetPlaneMarkerStyles(
  marker: L.Marker,
  markerEl: HTMLElement | undefined,
  tooltipEl: HTMLElement | undefined
): void {
  if (markerEl) {
    markerEl.classList.remove(
      'highlighted-marker',
      'followed-plane',
      'grounded-plane',
      'new-plane',
      'military-plane',
      'special-plane'
    );
  }
  if (tooltipEl) {
    tooltipEl.classList.remove(
      'highlighted-tooltip',
      'followed-plane-tooltip',
      'grounded-plane-tooltip',
      'new-plane-tooltip',
      'military-plane-tooltip'
    );
  }
  marker.setZIndexOffset(0);
}

export function applyFollowedMarkerStyles(
  marker: L.Marker,
  markerEl: HTMLElement | undefined,
  tooltipEl: HTMLElement | undefined
): void {
  marker.setZIndexOffset(20000);
  if (markerEl) {
    markerEl.classList.add('highlighted-marker');
    if (!markerEl.classList.contains('military-plane') && !markerEl.classList.contains('special-plane')) {
      markerEl.classList.add('followed-plane');
    }
  }
  if (tooltipEl) {
    tooltipEl.classList.add('highlighted-tooltip', 'followed-plane-tooltip');
  }
}

export function applyGroundedMarkerStyles(
  markerEl: HTMLElement | undefined,
  tooltipEl: HTMLElement | undefined
): void {
  if (markerEl) markerEl.classList.add('grounded-plane');
  if (tooltipEl) tooltipEl.classList.add('grounded-plane-tooltip');
}

export function applyNewMarkerStyles(
  markerEl: HTMLElement | undefined,
  tooltipEl: HTMLElement | undefined
): void {
  if (markerEl) markerEl.classList.add('new-plane');
  if (tooltipEl) tooltipEl.classList.add('new-plane-tooltip');
}

export function applyMilitaryMarkerStyles(
  markerEl: HTMLElement | undefined,
  tooltipEl: HTMLElement | undefined
): void {
  if (markerEl) markerEl.classList.add('military-plane');
  if (tooltipEl) tooltipEl.classList.add('military-plane-tooltip');
}

export function applySpecialMarkerStyles(markerEl: HTMLElement | undefined): void {
  if (markerEl) markerEl.classList.add('special-plane');
}

export function applyAltitudeBorderToTooltip(
  tooltipEl: HTMLElement | undefined,
  altitude: number | null | undefined,
  showBorders: boolean,
  altitudeColor: string
): void {
  if (!tooltipEl || altitude == null || !showBorders) return;
  tooltipEl.style.borderColor = altitudeColor;
  tooltipEl.classList.add('altitude-bordered-tooltip');
}

export function updateSinglePlaneVisuals(
  plane: PlaneModel,
  highlightedIcao: string | null,
  showAltitudeBorders: boolean,
  getAltitudeColor: (alt: number) => string
): void {
  const marker = plane.marker;
  if (!marker) return;
  const markerEl = marker.getElement();
  const tooltipEl = marker.getTooltip()?.getElement();
  resetPlaneMarkerStyles(marker, markerEl, tooltipEl);
  if (plane.icao === highlightedIcao) applyFollowedMarkerStyles(marker, markerEl, tooltipEl);
  if (plane.onGround) applyGroundedMarkerStyles(markerEl, tooltipEl);
  if (plane.isNew) applyNewMarkerStyles(markerEl, tooltipEl);
  if (plane.isMilitary) applyMilitaryMarkerStyles(markerEl, tooltipEl);
  if (plane.isSpecial) applySpecialMarkerStyles(markerEl);
  applyAltitudeBorderToTooltip(tooltipEl, plane.altitude, showAltitudeBorders, getAltitudeColor(plane.altitude!));
}
