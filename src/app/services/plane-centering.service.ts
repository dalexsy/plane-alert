import { Injectable } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';
import { PlaneModel } from '../models/plane-model';
import { FollowCoordinatorService } from './follow-coordinator.service';
import { PlaneLogService } from './plane-log.service';

@Injectable({
  providedIn: 'root',
})
export class PlaneCenteringService {
  constructor(
    private followCoordinatorService: FollowCoordinatorService,
    private planeLogService: PlaneLogService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Center the map and toggle highlight on the selected plane.
   * Clears followNearest unless preserveFollowNearest is true.
   */
  centerOnPlane(
    plane: PlaneLogEntry | PlaneModel,
    preserveFollowNearest = false,
    fromShuffle = false,
    context: {
      highlightedPlaneIcao: string | null;
      followNearest: boolean;
      planeLog: Map<string, PlaneModel>;
      map: L.Map;
      reverseGeocode: (lat: number, lon: number) => Promise<string>;
      locationDistrict: string | null;
      closestPlane: PlaneModel | null;
      planeHistoricalLog: PlaneModel[];
      setHighlightedPlaneIcao: (icao: string | null) => void;
      setFollowNearest: (value: boolean) => void;
      setClosestPlane: (plane: PlaneModel | null) => void;
      setLocationDistrict: (district: string) => void;
      setPlaneHistoricalLog: (log: PlaneModel[]) => void;
      unhighlightPlane: (icao: string) => void;
    }
  ): void {
    // If clicking the already highlighted plane, unfollow it
    if (
      !fromShuffle &&
      context.highlightedPlaneIcao === plane.icao &&
      !preserveFollowNearest
    ) {
      context.unhighlightPlane(plane.icao);
      context.setHighlightedPlaneIcao(null);
      context.setFollowNearest(false);

      // Clear follow state
      this.followCoordinatorService.clearAllModes();

      context.setPlaneHistoricalLog(
        this.planeLogService.updatePlaneLog(
          Array.from(context.planeLog.values())
        )
      );
      this.cdr.detectChanges();
      return;
    }

    // Handle manual plane following - this disables automatic modes
    if (!fromShuffle && !preserveFollowNearest) {
      this.followCoordinatorService.followPlaneManually(plane as PlaneLogEntry);
    }

    // When manually centering/following a plane, disable automatic nearest following
    // and enable manual following instead
    context.setFollowNearest(fromShuffle); // Only true if this is from shuffle mode

    const icao = plane.icao;

    if (context.highlightedPlaneIcao) {
      context.unhighlightPlane(context.highlightedPlaneIcao);
    }

    context.setHighlightedPlaneIcao(icao);
    const pm = context.planeLog.get(icao);
    if (pm?.marker && plane.lat != null && plane.lon != null) {
      // Pan map to plane location without changing zoom with smooth animation
      context.map.panTo([plane.lat, plane.lon], {
        animate: true,
        duration: 1.0,
      });

      pm.marker.setZIndexOffset(20000);
      pm.marker.openTooltip();
      const tooltip = pm.marker.getTooltip();
      if (tooltip) {
        const tooltipEl = tooltip.getElement();
        tooltipEl?.classList.add('highlighted-tooltip');
      }
      const markerEl = pm.marker.getElement();
      markerEl?.classList.add('highlighted-marker');

      context.reverseGeocode(plane.lat!, plane.lon!).then((address) => {
        // Don't update the address input field when following a plane
        // The address field should show map center location, not plane location
        // Guard against missing input reference
        // if (this.inputOverlayComponent.addressInputRef) {
        //   this.inputOverlayComponent.addressInputRef.setValue(address);
        // }

        // Update location overlay info using the same address result
        if (!address || address.trim() === '') {
          console.log('Empty geocoding result for followed plane:', address);
        }
        context.setLocationDistrict(address);
        if (
          !context.locationDistrict ||
          context.locationDistrict.trim() === ''
        ) {
          console.log(
            'locationDistrict is empty after setting (followed plane):',
            context.locationDistrict
          );
        }
        this.cdr.detectChanges();
      });

      // Refresh logs and overlays
      context.setClosestPlane(pm);
      context.setPlaneHistoricalLog(
        this.planeLogService.updatePlaneLog(
          Array.from(context.planeLog.values())
        )
      );
      this.cdr.detectChanges();
    } else {
      // Could not highlight plane - marker missing or coordinates invalid would be logged here
    }
  }
}
