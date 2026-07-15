import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { DistanceUnit } from '../../utils/units/units.util';
import {
  createOrUpdatePlaneMarker,
  removeLeftMarkerFromPlane,
} from '../../utils/plane-marker/plane-marker';
import { AltitudeColorService } from '../altitude-color/altitude-color.service';
import { HelicopterIdentificationService } from '../helicopter-identification/helicopter-identification.service';
import { OperatorTooltipService } from '../operator-tooltip/operator-tooltip.service';
import { SettingsService } from '../settings/settings.service';
import {
  buildPlaneTooltipHtml,
  computeExtraStyle,
  determineTrackForMarker,
} from './plane-visualization-marker.util';

@Injectable({ providedIn: 'root' })
export class PlaneVisualizationService {
  constructor(
    private altitudeColor: AltitudeColorService,
    private helicopterIdentificationService: HelicopterIdentificationService,
    private operatorTooltipService: OperatorTooltipService,
    private settings: SettingsService
  ) {}

  removePlaneVisuals(plane: PlaneModel, map: L.Map): void {
    if (plane.marker) removeLeftMarkerFromPlane(plane.marker, map);
    plane.marker?.remove();
    plane.path?.remove();
    plane.predictedPathArrowhead?.remove();
    plane.removeHistoryTrailSegments(map);
  }

  createPlaneMarker(
    plane: PlaneModel,
    map: L.Map,
    lat: number,
    lon: number,
    track: number,
    altitude: number | null,
    onGround: boolean,
    isNew: boolean,
    isMilitary: boolean,
    isSpecial: boolean,
    isUnknown: boolean,
    model: string,
    icao: string,
    callsign: string,
    getFlagHTML: (origin: string) => string,
    userUnit: DistanceUnit,
    centerLat: number,
    centerLon: number
  ): L.Marker {
    const tooltip = buildPlaneTooltipHtml(plane, userUnit, centerLat, centerLon, getFlagHTML, this.altitudeColor);
    const extraStyle = computeExtraStyle(altitude, onGround, this.altitudeColor);
    const trackForMarker = determineTrackForMarker(track, onGround, plane.positionHistory, lat, lon);
    const planeData = {
      icao, callsign, operator: plane.operator, registration: '', model, isMilitary,
      country: plane.origin, altitude, onGround, isSpecial, isUnknown,
    };
    const { marker } = createOrUpdatePlaneMarker(
      plane.marker, map, lat, lon, trackForMarker, extraStyle, isNew, onGround, tooltip, '',
      isMilitary, model,
      this.helicopterIdentificationService.isHelicopter(icao, model, plane.operator),
      isSpecial, isUnknown, altitude, false, this.settings.interval, icao, callsign,
      this.operatorTooltipService,
      planeData,
      this.settings.animationsEnabled !== false,
      this.settings.showGhostPosition !== false
    );
    if (altitude != null) {
      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.classList.add('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = this.altitudeColor.getFillColor(altitude);
      }
    }
    return marker;
  }

  updateTooltipForUnitChange(
    plane: PlaneModel,
    map: L.Map,
    centerLat: number,
    centerLon: number,
    getFlagHTML: (origin: string) => string,
    userUnit: DistanceUnit
  ): void {
    if (!plane.marker) return;
    const tooltip = buildPlaneTooltipHtml(plane, userUnit, centerLat, centerLon, getFlagHTML, this.altitudeColor);
    if (plane.marker.getTooltip()) plane.marker.unbindTooltip();
    const onGround = plane.onGround ?? false;
    plane.marker.bindTooltip(tooltip, {
      permanent: true,
      direction: 'right',
      offset: onGround ? L.point(-10, 0) : L.point(10, 0),
      interactive: true,
      className: `plane-tooltip ${onGround ? 'grounded-plane-tooltip' : ''} ${plane.isNew ? 'new-plane-tooltip' : ''} ${plane.isMilitary ? 'military-plane-tooltip' : ''} ${plane.isSpecial ? 'special-plane-tooltip' : ''}`,
      pane: 'tooltipPane',
    });
    if (plane.altitude != null) {
      const tooltipEl = plane.marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.classList.add('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = this.altitudeColor.getFillColor(plane.altitude);
      }
    }
  }
}
