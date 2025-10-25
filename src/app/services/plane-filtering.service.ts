import { Injectable } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { AircraftDbService } from './aircraft-db.service';
import { PlaneFilterService } from './plane-filter.service';
import { SettingsService } from './settings.service';
import { PlaneLogService } from './plane-log.service';
import { PlaneModel } from '../models/plane-model';

@Injectable({
  providedIn: 'root',
})
export class PlaneFilteringService {
  constructor(
    private aircraftDb: AircraftDbService,
    private planeFilter: PlaneFilterService,
    private settings: SettingsService,
    private planeLogService: PlaneLogService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Handle changes to the commercial filter exclude setting
   */
  onExcludeDiscountChange(
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    map: L.Map
  ): void {
    const exclude = this.settings.excludeDiscount;
    // Don't set the property again to avoid infinite loop
    localStorage.setItem('excludeDiscount', exclude.toString());

    // Reset the filteredOut flag for all planes to ensure proper re-evaluation
    for (const plane of planeLog.values()) {
      // Get military status
      const isMilitary = this.aircraftDb.lookup(plane.icao)?.mil || false;

      // If commercial filter is OFF (exclude is false), all planes should be shown
      if (!exclude) {
        plane.filteredOut = false;
        if (plane.marker && !map.hasLayer(plane.marker)) {
          plane.marker.addTo(map);
          if (plane.path) plane.path.addTo(map);
          if (plane.predictedPathArrowhead)
            plane.predictedPathArrowhead.addTo(map);
          // Re-add history trail segments if they exist
          if (plane.historyTrailSegments) {
            plane.historyTrailSegments.forEach((segment) => segment.addTo(map));
          }
        }
        continue;
      }

      // If commercial filter is ON, check if this plane should be filtered
      const isFiltered = !this.planeFilter.shouldIncludeCallsign(
        plane.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        isMilitary
      );

      plane.filteredOut = isFiltered;

      if (isFiltered) {
        // Use the new helper method to remove all visuals
        plane.removeVisuals(map);
      } else if (plane.marker && !map.hasLayer(plane.marker)) {
        // Only add back if not filtered
        plane.marker.addTo(map);
        // Add back path and arrowhead if they exist
        if (plane.path) plane.path.addTo(map);
        if (plane.predictedPathArrowhead)
          plane.predictedPathArrowhead.addTo(map);
        // Re-add history trail segments if they exist
        if (plane.historyTrailSegments) {
          plane.historyTrailSegments.forEach((segment) => segment.addTo(map));
        }
      }
    }

    // Also update the historical log using the same logic
    for (const plane of planeHistoricalLog) {
      const isMilitary = this.aircraftDb.lookup(plane.icao)?.mil || false;

      // If commercial filter is OFF (exclude is false), no plane should be filtered
      if (!exclude) {
        plane.filteredOut = false;
        continue;
      }

      // If commercial filter is ON, check if this plane should be filtered
      plane.filteredOut = !this.planeFilter.shouldIncludeCallsign(
        plane.callsign,
        exclude,
        this.planeFilter.getFilterPrefixes(),
        isMilitary
      );
      // Note: We don't remove visuals from the historical log directly here,
      // as they are managed by the main planeLog. We just update the flag.
    }

    // Update the plane historical log through the service
    const updatedLog = this.planeLogService.updatePlaneLog(
      Array.from(planeLog.values())
    );
    // The service updates its internal state, but we don't need to assign back
    // since the component will get the updated data through other means

    this.cdr.detectChanges();
  }
}
