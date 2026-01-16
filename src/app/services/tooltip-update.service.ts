import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel } from '../models/plane-model';
import { planeTooltip } from '../utils/tooltip';
import {
  convertKmToTooltipDistance,
  convertAltitudeForTooltip,
  convertSpeedForTooltip,
  DistanceUnit,
} from '../utils/units.util';
import { AltitudeColorService } from './altitude-color.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class TooltipUpdateService {
  private currentPlaneLog: Map<string, PlaneModel> = new Map();
  private currentMap: L.Map | null = null;
  private currentCenterLat: number = 0;
  private currentCenterLon: number = 0;
  private currentGetFlagHTML: ((origin: string) => string) | null = null;

  constructor(
    private altitudeColor: AltitudeColorService,
    private settings: SettingsService
  ) {}

  setCurrentContext(
    planeLog: Map<string, PlaneModel>,
    map: L.Map,
    centerLat: number,
    centerLon: number,
    getFlagHTML: (origin: string) => string
  ): void {
    this.currentPlaneLog = planeLog;
    this.currentMap = map;
    this.currentCenterLat = centerLat;
    this.currentCenterLon = centerLon;
    this.currentGetFlagHTML = getFlagHTML;
  }

  updateAllTooltipsForUnitChange(): void {
    if (
      !this.currentMap ||
      !this.currentGetFlagHTML ||
      this.currentPlaneLog.size === 0
    ) {
      return;
    }

    const userUnit = this.settings.distanceUnit as DistanceUnit;

    // Update each plane's tooltip
    for (const [id, planeModel] of this.currentPlaneLog) {
      if (!planeModel.marker) continue;

      this.updateTooltipForPlane(planeModel, userUnit);
    }
  }

  updateTooltipForPlaneNow(planeModel: PlaneModel): void {
    if (!this.currentMap || !this.currentGetFlagHTML) return;
    const userUnit = this.settings.distanceUnit as DistanceUnit;
    this.updateTooltipForPlane(planeModel, userUnit);
  }

  private updateTooltipForPlane(
    planeModel: PlaneModel,
    userUnit: DistanceUnit
  ): void {
    if (!planeModel.marker) return;

    const { lat, lon, altitude, callsign, model, operator, origin } =
      planeModel;
    const velocity = planeModel.velocity;

    // Recalculate speed text with user's unit preference
    let speedText = '';
    if (velocity) {
      const { value: speedValue, label: speedLabel } = convertSpeedForTooltip(
        velocity,
        userUnit
      );
      speedText = `${speedValue}${speedLabel}`;
    }

    // Recalculate altitude text with new unit
    let altText = '';
    if (altitude) {
      const { value: altValue, label: altLabel } = convertAltitudeForTooltip(
        altitude,
        userUnit
      );
      altText = `${altValue}${altLabel}`;
    }

    // Recalculate distance text
    const distanceKm = this.haversineDistance(
      this.currentCenterLat,
      this.currentCenterLon,
      lat,
      lon
    );
    const { value: distanceValue, label: distanceLabel } =
      convertKmToTooltipDistance(distanceKm, userUnit);
    const distanceText = `${distanceValue}${distanceLabel}`;

    // Get current state
    const isNew = planeModel.isNew;
    const onGround = planeModel.onGround ?? false;
    const isMilitary = planeModel.isMilitary ?? false;
    const isSpecial = planeModel.isSpecial ?? false;
    const isStale = planeModel.isStale ?? false;
    const verticalRate = planeModel.verticalRate ?? null;

    // Generate new tooltip
    const tooltip = planeTooltip(
      planeModel.icao,
      callsign,
      origin,
      model,
      operator,
      speedText,
      altText,
      this.currentGetFlagHTML!,
      isNew,
      onGround,
      isMilitary,
      isSpecial,
      isStale,
      verticalRate,
      altitude,
      (alt: number) => this.altitudeColor.getFillColor(alt),
      undefined, // No operator logo in right tooltip
      distanceText,
      planeModel.routeOriginIata || planeModel.routeOrigin,
      planeModel.routeDestinationIata || planeModel.routeDestination
    );

    // Update the marker's tooltip
    if (planeModel.marker.getTooltip()) {
      planeModel.marker.unbindTooltip();
    }

    // Define tooltip options
    const rightTooltipOptions: L.TooltipOptions = {
      permanent: true,
      direction: 'right',
      offset: onGround ? L.point(-10, 0) : L.point(10, 0),
      interactive: true,
      className: `plane-tooltip ${onGround ? 'grounded-plane-tooltip' : ''} ${
        isNew ? 'new-plane-tooltip' : ''
      } ${isMilitary ? 'military-plane-tooltip' : ''} ${
        isSpecial ? 'special-plane-tooltip' : ''
      } ${isStale ? 'stale-plane-tooltip' : ''}`,
      pane: 'tooltipPane',
    };

    planeModel.marker.bindTooltip(tooltip, rightTooltipOptions);

    const tooltipEl = planeModel.marker.getTooltip()?.getElement();
    if (tooltipEl) {
      if (isStale) {
        tooltipEl.classList.remove('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = '';
      } else if (altitude != null) {
        tooltipEl.classList.add('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = this.altitudeColor.getFillColor(altitude);
      }
    }
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
