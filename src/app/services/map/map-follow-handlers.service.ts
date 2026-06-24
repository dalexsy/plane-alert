import { Injectable, ChangeDetectorRef } from '@angular/core';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { FollowService } from '../follow.service';
import { PlaneCenteringService } from '../plane-centering.service';
import { FollowCoordinatorService } from '../follow-coordinator.service';
import { PlaneModel } from '../../models/plane-model';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { MapPlaneOperationsService } from './map-plane-operations.service';

@Injectable({ providedIn: 'root' })
export class MapFollowHandlersService {
  constructor(
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private followService: FollowService,
    private planeCentering: PlaneCenteringService,
    private followCoordinatorService: FollowCoordinatorService,
    private planeOps: MapPlaneOperationsService
  ) {}

  handleFollowStateChange(followState: {
    mode: string;
    followedPlaneIcao?: string | null;
  }, cdr: ChangeDetectorRef): void {
    if (followState.mode === 'none') {
      this.overlay.followNearest = false;
      this.overlay.highlightedPlaneIcao = null;
    } else if (followState.followedPlaneIcao) {
      this.overlay.highlightedPlaneIcao = followState.followedPlaneIcao;
      this.overlay.followNearest = followState.mode !== 'manual';
    }
    this.followService.updateFollowedStyles(
      this.runtime.planeLog,
      this.overlay.highlightedPlaneIcao
    );
    cdr.detectChanges();
  }

  handleFollowRequest(
    followRequest: {
      plane?: PlaneModel & PlaneLogEntry;
      fromShuffle?: boolean;
      fromNearest?: boolean;
    },
    cdr: ChangeDetectorRef
  ): void {
    if (this.runtime.isProcessingFollowRequest) return;
    this.runtime.isProcessingFollowRequest = true;
    try {
      const { plane, fromShuffle = false, fromNearest = false } = followRequest;
      if (!plane) return;
      this.centerOnPlane(plane, fromShuffle || fromNearest, fromShuffle, cdr);
    } finally {
      this.runtime.isProcessingFollowRequest = false;
    }
  }

  unhighlightPlane(icao: string): void {
    const pm = this.runtime.planeLog.get(icao);
    if (pm?.marker) {
      pm.marker.getTooltip()?.getElement()?.classList.remove('highlighted-tooltip');
      pm.marker.getElement()?.classList.remove('highlighted-marker');
      pm.marker.setZIndexOffset(0);
    }
  }

  centerOnPlane(
    plane: PlaneLogEntry | PlaneModel,
    preserveFollowNearest = false,
    fromShuffle = false,
    cdr: ChangeDetectorRef
  ): void {
    this.planeCentering.centerOnPlane(plane, preserveFollowNearest, fromShuffle, {
      highlightedPlaneIcao: this.overlay.highlightedPlaneIcao,
      followNearest: this.overlay.followNearest,
      planeLog: this.runtime.planeLog,
      map: this.runtime.map,
      reverseGeocode: (lat, lon) => this.planeOps.reverseGeocode(lat, lon),
      locationDistrict: this.overlay.locationDistrict,
      closestPlane: this.overlay.closestPlane,
      planeHistoricalLog: this.runtime.planeHistoricalLog,
      setHighlightedPlaneIcao: (icao) => (this.overlay.highlightedPlaneIcao = icao),
      setFollowNearest: (value) => (this.overlay.followNearest = value),
      setClosestPlane: (p) => (this.overlay.closestPlane = p),
      setLocationDistrict: (district) => (this.overlay.locationDistrict = district),
      setPlaneHistoricalLog: (log) => (this.runtime.planeHistoricalLog = log),
      unhighlightPlane: (icao) => this.unhighlightPlane(icao),
    });
    cdr.detectChanges();
  }

  followNearestPlane(plane: PlaneLogEntry | { isMarker?: boolean; followMe?: boolean; icao: string }, cdr: ChangeDetectorRef): void {
    if (plane.isMarker) return;
    const isFromShuffle = !!plane.followMe;
    if (isFromShuffle) {
      this.overlay.followNearest = true;
      this.centerOnPlane(plane as PlaneLogEntry, false, true, cdr);
    } else {
      this.followCoordinatorService.followPlaneManually(plane as PlaneModel);
    }
  }

  onHoverOverlayPlane(plane: PlaneLogEntry): void {
    const pm = this.runtime.planeLog.get(plane.icao);
    if (pm?.marker && plane.icao !== this.overlay.highlightedPlaneIcao) {
      pm.marker.setZIndexOffset(5000);
      pm.marker.openTooltip();
      pm.marker.getTooltip()?.getElement()?.classList.add('highlighted-tooltip');
    }
  }

  onUnhoverOverlayPlane(plane: PlaneLogEntry): void {
    const pm = this.runtime.planeLog.get(plane.icao);
    if (pm?.marker && plane.icao !== this.overlay.highlightedPlaneIcao) {
      pm.marker.setZIndexOffset(0);
      if (!pm.marker.isTooltipOpen()) {
        pm.marker.closeTooltip();
      }
      pm.marker.getTooltip()?.getElement()?.classList.remove('highlighted-tooltip');
    }
  }
}
