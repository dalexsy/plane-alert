import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../models/plane-model';
import { AltitudeColorService } from './altitude-color.service';

@Injectable({
  providedIn: 'root',
})
export class PlaneDisplayService {
  private map!: L.Map;
  private altitudeColorService: AltitudeColorService;

  constructor(altitudeColorService: AltitudeColorService) {
    this.altitudeColorService = altitudeColorService;
  }

  /**
   * Initialize the service with the map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
  }

  /**
   * Update visual styles for all planes based on their properties
   */
  updateAllPlaneVisuals(
    planes: PlaneModel[],
    highlightedIcao: string | null,
    followNearest: boolean
  ): void {
    planes.forEach((plane) => {
      this.updateSinglePlaneVisuals(plane, highlightedIcao, followNearest);
    });
  }

  /**
   * Update visual styles for a single plane
   */
  private updateSinglePlaneVisuals(
    plane: PlaneModel,
    highlightedIcao: string | null,
    followNearest: boolean
  ): void {
    const marker = plane.marker;
    if (!marker) return;

    const markerEl = marker.getElement();
    const tooltipEl = marker.getTooltip()?.getElement();

    // Reset all styles first
    this.resetPlaneStyles(marker, markerEl, tooltipEl);

    // Apply followed styles if this plane is highlighted
    if (plane.icao === highlightedIcao) {
      this.applyFollowedStyles(marker, markerEl, tooltipEl, plane);
    }

    // Apply grounded styles
    if (plane.onGround) {
      this.applyGroundedStyles(markerEl, tooltipEl);
    }

    // Apply new plane styles
    if (plane.isNew) {
      this.applyNewPlaneStyles(markerEl, tooltipEl);
    }

    // Apply military styles
    if (plane.isMilitary) {
      this.applyMilitaryStyles(markerEl, tooltipEl);
    }

    // Apply special plane styles
    if (plane.isSpecial) {
      this.applySpecialStyles(markerEl);
    }

    // Apply altitude borders if enabled
    this.applyAltitudeBorders(plane, tooltipEl);
  }

  /**
   * Reset all visual styles on a plane
   */
  private resetPlaneStyles(
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
        'military-plane-tooltip',
        'altitude-bordered-tooltip'
      );
      tooltipEl.style.borderColor = '';
    }

    marker.setZIndexOffset(0);
  }

  /**
   * Apply followed/highlighted styles
   */
  private applyFollowedStyles(
    marker: L.Marker,
    markerEl: HTMLElement | undefined,
    tooltipEl: HTMLElement | undefined,
    plane: PlaneModel
  ): void {
    marker.setZIndexOffset(20000);

    if (markerEl) {
      markerEl.classList.add('highlighted-marker');
      // Add followed-plane class for cyan border unless military or special
      if (
        !markerEl.classList.contains('military-plane') &&
        !markerEl.classList.contains('special-plane')
      ) {
        markerEl.classList.add('followed-plane');
      }
    }

    if (tooltipEl) {
      tooltipEl.classList.add('highlighted-tooltip');
      tooltipEl.classList.add('followed-plane-tooltip');
    }
  }

  /**
   * Apply grounded plane styles
   */
  private applyGroundedStyles(
    markerEl: HTMLElement | undefined,
    tooltipEl: HTMLElement | undefined
  ): void {
    if (markerEl) {
      markerEl.classList.add('grounded-plane');
    }
    if (tooltipEl) {
      tooltipEl.classList.add('grounded-plane-tooltip');
    }
  }

  /**
   * Apply new plane styles
   */
  private applyNewPlaneStyles(
    markerEl: HTMLElement | undefined,
    tooltipEl: HTMLElement | undefined
  ): void {
    if (markerEl) {
      markerEl.classList.add('new-plane');
    }
    if (tooltipEl) {
      tooltipEl.classList.add('new-plane-tooltip');
    }
  }

  /**
   * Apply military plane styles
   */
  private applyMilitaryStyles(
    markerEl: HTMLElement | undefined,
    tooltipEl: HTMLElement | undefined
  ): void {
    if (markerEl) {
      markerEl.classList.add('military-plane');
    }
    if (tooltipEl) {
      tooltipEl.classList.add('military-plane-tooltip');
    }
  }

  /**
   * Apply special plane styles
   */
  private applySpecialStyles(markerEl: HTMLElement | undefined): void {
    if (markerEl) {
      markerEl.classList.add('special-plane');
    }
  }

  /**
   * Apply altitude-colored borders to tooltips
   */
  private applyAltitudeBorders(
    plane: PlaneModel,
    tooltipEl: HTMLElement | undefined
  ): void {
    if (!tooltipEl || plane.altitude == null) return;

    // Get altitude color from the service
    const altitudeColor = this.altitudeColorService.getFillColor(
      plane.altitude
    );

    // Apply altitude-colored border
    tooltipEl.style.borderColor = altitudeColor;
    tooltipEl.classList.add('altitude-bordered-tooltip');
  }

  /**
   * Update tooltip altitude borders for all planes
   */
  updateTooltipAltitudeBorders(planes: PlaneModel[], enabled: boolean): void {
    planes.forEach((plane) => {
      const tooltipEl = plane.marker?.getTooltip()?.getElement();
      if (!tooltipEl) return;

      if (enabled && plane.altitude != null) {
        const altitudeColor = this.altitudeColorService.getFillColor(
          plane.altitude
        );
        tooltipEl.style.borderColor = altitudeColor;
        tooltipEl.classList.add('altitude-bordered-tooltip');
      } else {
        tooltipEl.style.borderColor = '';
        tooltipEl.classList.remove('altitude-bordered-tooltip');
      }
    });
  }

  /**
   * Temporarily highlight marker and tooltip on overlay hover
   */
  applyHoverStyles(plane: PlaneModel, highlightedIcao: string | null): void {
    if (!plane.marker || plane.icao === highlightedIcao) return;

    plane.marker.setZIndexOffset(5000);
    plane.marker.openTooltip();

    const tooltipEl = plane.marker.getTooltip()?.getElement();
    if (tooltipEl) {
      tooltipEl.classList.add('highlighted-tooltip');
    }
  }

  /**
   * Remove temporary highlight on overlay hover out
   */
  removeHoverStyles(plane: PlaneModel, highlightedIcao: string | null): void {
    if (!plane.marker || plane.icao === highlightedIcao) return;

    plane.marker.setZIndexOffset(0);

    const tooltip = plane.marker.getTooltip();
    if (tooltip && !tooltip.isOpen()) {
      plane.marker.closeTooltip();
    }

    const tooltipEl = tooltip?.getElement();
    if (tooltipEl) {
      tooltipEl.classList.remove('highlighted-tooltip');
    }
  }

  /**
   * Center map on a plane with smooth animation
   */
  centerOnPlane(plane: PlaneModel): void {
    if (!plane.marker || plane.lat == null || plane.lon == null) return;

    this.map.panTo([plane.lat, plane.lon], { animate: true, duration: 1.0 });
    plane.marker.openTooltip();
  }

  /**
   * Apply animation setting to document body
   */
  applyAnimationSetting(enabled: boolean, document: Document): void {
    if (enabled) {
      document.body.classList.remove('animations-disabled');
    } else {
      document.body.classList.add('animations-disabled');
    }
  }

  /**
   * Update visual styles for a single plane based on its properties and filter status
   */
  updatePlaneVisuals(plane: PlaneModel, isMilitary: boolean): void {
    // Handle visuals based on filter status
    if (plane.filteredOut) {
      // Use the new helper method to remove all visuals for filtered planes
      plane.removeVisuals(this.map);
    } else {
      // If not filtered, proceed with marker/tooltip updates if marker exists
      if (plane.marker) {
        // Reset styles first
        this.resetPlaneStyles(
          plane.marker,
          plane.marker.getElement(),
          plane.marker.getTooltip()?.getElement()
        );

        // Apply styles based on plane properties
        if (plane.onGround) {
          this.applyGroundedStyles(
            plane.marker.getElement(),
            plane.marker.getTooltip()?.getElement()
          );
        }

        if (plane.isNew) {
          this.applyNewPlaneStyles(
            plane.marker.getElement(),
            plane.marker.getTooltip()?.getElement()
          );
        }

        if (isMilitary) {
          this.applyMilitaryStyles(
            plane.marker.getElement(),
            plane.marker.getTooltip()?.getElement()
          );
        }

        // Apply altitude borders if enabled (this will be handled separately)
        // this.applyAltitudeBorders(plane, plane.marker.getTooltip()?.getElement());
      }
    }
  }
}
