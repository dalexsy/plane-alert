import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { AltitudeColorService } from '../altitude-color/altitude-color.service';
import {
  applyGroundedMarkerStyles,
  applyMilitaryMarkerStyles,
  applyNewMarkerStyles,
  resetPlaneMarkerStyles,
  updateSinglePlaneVisuals,
} from './plane-display-styles.util';

@Injectable({ providedIn: 'root' })
export class PlaneDisplayService {
  private map!: L.Map;
  private showAltitudeBorders = true;

  constructor(private altitudeColorService: AltitudeColorService) {}

  initialize(map: L.Map): void {
    this.map = map;
  }

  setAltitudeBordersEnabled(enabled: boolean): void {
    this.showAltitudeBorders = enabled;
  }

  updateAllPlaneVisuals(planes: PlaneModel[], highlightedIcao: string | null, followNearest: boolean): void {
    planes.forEach((plane) =>
      updateSinglePlaneVisuals(plane, highlightedIcao, this.showAltitudeBorders, (alt) =>
        this.altitudeColorService.getFillColor(alt)
      )
    );
  }

  updateTooltipAltitudeBorders(planes: PlaneModel[], enabled: boolean): void {
    this.showAltitudeBorders = enabled;
    planes.forEach((plane) => {
      const tooltipEl = plane.marker?.getTooltip()?.getElement();
      if (!tooltipEl) return;
      if (enabled && plane.altitude != null) {
        tooltipEl.style.borderColor = this.altitudeColorService.getFillColor(plane.altitude);
        tooltipEl.classList.add('altitude-bordered-tooltip');
      } else {
        tooltipEl.style.borderColor = '';
        tooltipEl.classList.remove('altitude-bordered-tooltip');
      }
    });
  }

  applyHoverStyles(plane: PlaneModel, highlightedIcao: string | null): void {
    if (!plane.marker || plane.icao === highlightedIcao) return;
    plane.marker.setZIndexOffset(5000);
    plane.marker.openTooltip();
    plane.marker.getTooltip()?.getElement()?.classList.add('highlighted-tooltip');
  }

  removeHoverStyles(plane: PlaneModel, highlightedIcao: string | null): void {
    if (!plane.marker || plane.icao === highlightedIcao) return;
    plane.marker.setZIndexOffset(0);
    const tooltip = plane.marker.getTooltip();
    if (tooltip && !tooltip.isOpen()) plane.marker.closeTooltip();
    tooltip?.getElement()?.classList.remove('highlighted-tooltip');
  }

  centerOnPlane(plane: PlaneModel): void {
    if (!plane.marker || plane.lat == null || plane.lon == null) return;
    this.map.panTo([plane.lat, plane.lon], { animate: true, duration: 1.0 });
    plane.marker.openTooltip();
  }

  applyAnimationSetting(enabled: boolean, document: Document): void {
    document.body.classList.toggle('animations-disabled', !enabled);
  }

  updatePlaneVisuals(plane: PlaneModel, isMilitary: boolean): void {
    if (plane.filteredOut) {
      plane.removeVisuals(this.map);
      return;
    }
    if (!plane.marker) return;
    const markerEl = plane.marker.getElement();
    const tooltipEl = plane.marker.getTooltip()?.getElement();
    resetPlaneMarkerStyles(plane.marker, markerEl, tooltipEl);
    if (plane.onGround) applyGroundedMarkerStyles(markerEl, tooltipEl);
    if (plane.isNew) applyNewMarkerStyles(markerEl, tooltipEl);
    if (isMilitary) applyMilitaryMarkerStyles(markerEl, tooltipEl);
  }
}
