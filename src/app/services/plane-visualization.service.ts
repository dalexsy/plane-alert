import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PlaneModel, PositionHistory } from '../models/plane-model';
import { planeTooltip } from '../utils/tooltip';
import {
  convertKmToTooltipDistance,
  convertAltitudeForTooltip,
  convertSpeedForTooltip,
  DistanceUnit,
} from '../utils/units.util';
import {
  createOrUpdatePlaneMarker,
  cancelMarkerAnimation,
  resumeMidFlightAnimation,
} from '../utils/plane-marker';
import { AltitudeColorService } from './altitude-color.service';
import { HelicopterIdentificationService } from './helicopter-identification.service';
import { OperatorTooltipService } from './operator-tooltip.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class PlaneVisualizationService {
  private colorCache = new Map<number, string>();

  constructor(
    private altitudeColor: AltitudeColorService,
    private helicopterIdentificationService: HelicopterIdentificationService,
    private operatorTooltipService: OperatorTooltipService,
    private settings: SettingsService
  ) {}

  removePlaneVisuals(plane: PlaneModel, map: L.Map): void {
    plane.removeVisuals(map);
  }

  cancelMarkerAnimations(planes: Iterable<PlaneModel>): void {
    for (const plane of planes) {
      if (plane.marker) {
        cancelMarkerAnimation(plane.marker);
      }
    }
  }

  resumeMidFlightAnimations(
    planes: Iterable<PlaneModel>,
    lastSnapshotTimestamp: number
  ): void {
    if (!this.settings.animationsEnabled || !lastSnapshotTimestamp) {
      console.debug(
        'Skipping resume: animations disabled or missing timestamp',
        {
          animations: this.settings.animationsEnabled,
          lastSnapshotTimestamp,
        }
      );
      return;
    }

    for (const plane of planes) {
      if (!plane.marker) {
        console.debug(`Skipping resume for ${plane.icao}: no marker`);
        continue;
      }

      if (plane.isStale === true) {
        continue;
      }

      resumeMidFlightAnimation(
        plane.marker,
        plane,
        this.settings.interval,
        plane.positionHistory.length > 0
          ? plane.positionHistory[plane.positionHistory.length - 1].timestamp
          : lastSnapshotTimestamp,
        this.settings.animationsEnabled,
        plane.icao
      );
    }
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
    centerLon: number,
    lastSnapshotTimestamp?: number
  ): L.Marker {
    // Derive classification from the PlaneModel as single source of truth.
    // (Call sites may pass stale booleans; the model is what both map + list render from.)
    const effectiveIsMilitary = plane.isMilitary === true;
    const effectiveIsSpecial = plane.isSpecial === true;
    const effectiveIsUnknown = plane.isUnknown === true;

    // Create tooltip
    const tooltip = this.createTooltip(
      plane,
      userUnit,
      centerLat,
      centerLon,
      getFlagHTML
    );

    // Compute extra style
    const extraStyle = this.computeExtraStyle(altitude, onGround);

    // Determine track for marker
    const trackForMarker = this.determineTrackForMarker(
      track,
      onGround,
      plane.positionHistory,
      lat,
      lon
    );

    // Prepare plane data for operator tooltip service
    const planeData = {
      icao,
      callsign,
      operator: plane.operator,
      registration: '', // Would need to be passed in
      model,
      isMilitary: effectiveIsMilitary,
      country: plane.origin,
      altitude,
      onGround,
      isSpecial: effectiveIsSpecial,
      isUnknown: effectiveIsUnknown,
      isStale: plane.isStale === true,
      positionHistory: plane.positionHistory,
      icaoType: plane.icaoType,
    };

    const latestHistoryTimestamp =
      plane.positionHistory.length > 0
        ? plane.positionHistory[plane.positionHistory.length - 1].timestamp
        : undefined;

    const animationTimestamp =
      typeof latestHistoryTimestamp === 'number'
        ? latestHistoryTimestamp
        : lastSnapshotTimestamp;

    const { marker } = createOrUpdatePlaneMarker(
      plane.marker,
      map,
      lat,
      lon,
      trackForMarker,
      extraStyle,
      isNew,
      onGround,
      tooltip,
      '', // customPlaneIcon
      effectiveIsMilitary,
      model,
      this.helicopterIdentificationService.isHelicopter(
        icao,
        model,
        plane.operator,
        plane.categoryCode,
        plane.icaoType
      ),
      effectiveIsSpecial,
      effectiveIsUnknown,
      altitude,
      false, // followed - would need to be passed in
      this.settings.interval,
      icao,
      callsign,
      this.operatorTooltipService,
      planeData,
      this.settings.animationsEnabled,
      animationTimestamp,
      this.settings.showGhostPosition
    );

    // Apply altitude border styling
    if (altitude != null) {
      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.classList.add('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = this.altitudeColor.getFillColor(altitude);
      }
    }

    return marker;
  }

  private createTooltip(
    plane: PlaneModel,
    userUnit: DistanceUnit,
    centerLat: number,
    centerLon: number,
    getFlagHTML: (origin: string) => string
  ): string {
    const { lat, lon, altitude, callsign, model, operator, origin } = plane;
    const velocity = plane.velocity;

    // Convert units
    let speedText = '';
    if (velocity) {
      const { value: speedValue, label: speedLabel } = convertSpeedForTooltip(
        velocity,
        userUnit
      );
      speedText = `${speedValue}${speedLabel}`;
    }

    let altText = '';
    if (altitude) {
      const { value: altValue, label: altLabel } = convertAltitudeForTooltip(
        altitude,
        userUnit
      );
      altText = `${altValue}${altLabel}`;
    }

    const distanceKm = this.haversineDistance(centerLat, centerLon, lat, lon);
    const { value: distanceValue, label: distanceLabel } =
      convertKmToTooltipDistance(distanceKm, userUnit);
    const distanceText = `${distanceValue}${distanceLabel}`;

    const isNew = plane.isNew;
    const onGround = plane.onGround ?? false;
    const isMilitary = plane.isMilitary ?? false;
    const isSpecial = plane.isSpecial ?? false;
    const isStale = plane.isStale ?? false;
    const verticalRate = plane.verticalRate ?? null;

    return planeTooltip(
      plane.icao,
      callsign,
      origin,
      model,
      operator,
      speedText,
      altText,
      getFlagHTML,
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
      plane.routeOriginIata || plane.routeOrigin,
      plane.routeDestinationIata || plane.routeDestination
    );
  }

  private computeExtraStyle(
    altitude: number | null,
    isGrounded: boolean
  ): string {
    if (isGrounded) {
      return this.randomizeBrightness();
    }
    if (altitude == null) {
      return '';
    }
    return `color: ${this.altitudeColor.getFillColor(altitude)};`;
  }

  private randomizeBrightness(): string {
    const brightness = (Math.random() * 0.4 + 0.8).toFixed(2);
    return `filter: brightness(${brightness});`;
  }

  private determineTrackForMarker(
    track: number | null,
    onGround: boolean,
    positionHistory: PositionHistory[],
    lat: number,
    lon: number
  ): number {
    if (onGround) {
      if (typeof track === 'number') {
        return track;
      }

      // Try to get track from history
      let lastKnownTrack: number | undefined;
      if (positionHistory && positionHistory.length > 0) {
        for (let i = positionHistory.length - 1; i >= 0; i--) {
          const historyPoint = positionHistory[i];
          if (typeof historyPoint.track === 'number') {
            lastKnownTrack = historyPoint.track;
            break;
          }
        }
      }

      // Calculate movement direction if no track available
      if (
        lastKnownTrack === undefined &&
        positionHistory &&
        positionHistory.length >= 2
      ) {
        const calculated = this.calculateMovementDirection(
          positionHistory,
          lat,
          lon
        );
        if (calculated !== null) {
          lastKnownTrack = calculated;
        }
      }

      return lastKnownTrack ?? 0;
    }

    return track ?? 0;
  }

  private calculateMovementDirection(
    positionHistory: PositionHistory[],
    currentLat: number,
    currentLon: number
  ): number | null {
    if (positionHistory.length < 2) {
      return null;
    }

    let previousPosition: PositionHistory | null = null;
    for (let i = positionHistory.length - 1; i >= 0; i--) {
      const position = positionHistory[i];
      const isValid = position.lat && position.lon;
      const isRecent = Date.now() - position.timestamp <= 10 * 60 * 1000;

      if (isValid && isRecent) {
        previousPosition = position;
        break;
      }
    }

    if (!previousPosition) {
      return null;
    }

    const latDiff = currentLat - previousPosition.lat;
    const lonDiff = currentLon - previousPosition.lon;
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

    const minMovementThreshold = 0.00001;
    if (distance < minMovementThreshold) {
      return null;
    }

    const lat1Rad = (previousPosition.lat * Math.PI) / 180;
    const lat2Rad = (currentLat * Math.PI) / 180;
    const deltaLonRad = ((currentLon - previousPosition.lon) * Math.PI) / 180;

    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

    const bearingRad = Math.atan2(y, x);
    const bearing = ((bearingRad * 180) / Math.PI + 360) % 360;

    return bearing;
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

  updateTooltipForUnitChange(
    plane: PlaneModel,
    map: L.Map,
    centerLat: number,
    centerLon: number,
    getFlagHTML: (origin: string) => string,
    userUnit: DistanceUnit
  ): void {
    if (!plane.marker) return;

    const { lat, lon, altitude, callsign, model, operator, origin } = plane;
    const velocity = plane.velocity;

    let speedText = '';
    if (velocity) {
      const { value: speedValue, label: speedLabel } = convertSpeedForTooltip(
        velocity,
        userUnit
      );
      speedText = `${speedValue}${speedLabel}`;
    }

    let altText = '';
    if (altitude) {
      const { value: altValue, label: altLabel } = convertAltitudeForTooltip(
        altitude,
        userUnit
      );
      altText = `${altValue}${altLabel}`;
    }

    const distanceKm = this.haversineDistance(centerLat, centerLon, lat, lon);
    const { value: distanceValue, label: distanceLabel } =
      convertKmToTooltipDistance(distanceKm, userUnit);
    const distanceText = `${distanceValue}${distanceLabel}`;

    const isNew = plane.isNew;
    const onGround = plane.onGround ?? false;
    const isMilitary = plane.isMilitary ?? false;
    const isSpecial = plane.isSpecial ?? false;
    const isStale = plane.isStale ?? false;
    const verticalRate = plane.verticalRate ?? null;

    const tooltip = planeTooltip(
      plane.icao,
      callsign,
      origin,
      model,
      operator,
      speedText,
      altText,
      getFlagHTML,
      isNew,
      onGround,
      isMilitary,
      isSpecial,
      isStale,
      verticalRate,
      altitude,
      (alt: number) => this.altitudeColor.getFillColor(alt),
      undefined,
      distanceText,
      plane.routeOrigin,
      plane.routeDestination
    );

    if (plane.marker.getTooltip()) {
      plane.marker.unbindTooltip();
    }

    const rightTooltipOptions: L.TooltipOptions = {
      permanent: true,
      direction: 'right',
      offset: onGround ? L.point(-10, 0) : L.point(10, 0),
      interactive: true,
      className: `plane-tooltip ${onGround ? 'grounded-plane-tooltip' : ''} ${
        isNew ? 'new-plane-tooltip' : ''
      } ${isMilitary ? 'military-plane-tooltip' : ''} ${
        isSpecial ? 'special-plane-tooltip' : ''
      }`,
      pane: 'tooltipPane',
    };

    plane.marker.bindTooltip(tooltip, rightTooltipOptions);

    if (altitude != null) {
      const tooltipEl = plane.marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.classList.add('altitude-bordered-tooltip');
        tooltipEl.style.borderColor = this.altitudeColor.getFillColor(altitude);
      }
    }
  }
}
