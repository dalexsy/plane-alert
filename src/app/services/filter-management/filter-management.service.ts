import { Injectable } from '@angular/core';
import { PlaneModel } from '../../models/plane-model';
import { SettingsService } from '../settings/settings.service';
import { PlaneFilterService } from '../plane-filter/plane-filter.service';
import { AircraftDbService } from '../aircraft-db/aircraft-db.service';
import { PlaneLogService } from '../plane-log/plane-log.service';

@Injectable({
  providedIn: 'root',
})
export class FilterManagementService {
  constructor(
    private settings: SettingsService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private planeLogService: PlaneLogService
  ) {}

  /**
   * Handle commercial filter changes
   */
  onExcludeDiscountChange(
    planeLog: Map<string, PlaneModel>,
    planeHistoricalLog: PlaneModel[],
    map: any
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

    // Update the plane log with current planes
    const updatedLog = this.planeLogService.updatePlaneLog(
      Array.from(planeLog.values())
    );
    // Replace the historical log with the updated version
    planeHistoricalLog.splice(0, planeHistoricalLog.length, ...updatedLog);
  }

  /**
   * Clear the seen plane list
   */
  clearSeenList(
    planeHistoricalLog: PlaneModel[],
    resultsOverlayComponent: any,
    cdr: any
  ): void {
    planeHistoricalLog.length = 0;
    resultsOverlayComponent.seenPlaneLog = [];
    cdr.detectChanges();
  }

  /**
   * Export the current filter list to a JSON file
   */
  exportFilterList(): void {
    const filters = this.planeFilter.getFilterPrefixes();
    localStorage.setItem('filterList', JSON.stringify(filters));
    const data = JSON.stringify(filters, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filter-list.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
