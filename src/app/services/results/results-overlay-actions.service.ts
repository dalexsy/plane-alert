import { Injectable, ChangeDetectorRef } from '@angular/core';
import { SpecialListService } from '../special-list/special-list.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { ResultsOverlayFacadeCore } from './results-overlay-facade.core';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayActionsService {
  constructor(private specialList: SpecialListService) {}

  toggleCommercialFilter(facade: ResultsOverlayFacadeCore): void {
    facade.setIgnoreNextFilterChange(true);
    facade.followUi.toggleCommercialFilter(() => facade.markResultsUpdated());
  }

  toggleSeenCollapsed(facade: ResultsOverlayFacadeCore, onDone?: () => void): void {
    facade.settings.setSeenCollapsed(!facade.settings.seenCollapsed);
    onDone?.();
  }

  toggleCollapsed(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): void {
    facade.collapsed = !facade.collapsed;
    facade.settings.setResultsOverlayCollapsed(facade.collapsed);
    cdr.detectChanges();
  }

  toggleShuffle(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): void {
    facade.followUi.toggleShuffle(facade.data.filteredSkyPlaneLog, cdr);
  }

  toggleNearest(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): void {
    facade.followUi.toggleNearest(facade.data.filteredSkyPlaneLog, cdr);
  }

  toggleMilitaryPriority(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): void {
    facade.followUi.toggleMilitaryPriority(
      facade.data.filteredSkyPlaneLog,
      () => {
        facade.markResultsUpdated();
        facade.refreshFiltered();
      },
      cdr
    );
  }

  toggleOtherControls(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): void {
    facade.otherControlsHidden = !facade.otherControlsHidden;
    facade.settings.setResultsOverlayControlsHidden(facade.otherControlsHidden);
    if (!facade.otherControlsHidden && facade.collapsed) {
      this.toggleCollapsed(facade, cdr);
    } else if (facade.otherControlsHidden && !facade.collapsed) {
      this.toggleCollapsed(facade, cdr);
    }
    cdr.markForCheck();
  }

  toggleSpecial(
    facade: ResultsOverlayFacadeCore,
    plane: PlaneLogEntry,
    cdr: ChangeDetectorRef
  ): void {
    plane.isSpecial = !plane.isSpecial;
    this.specialList.toggleSpecial(plane.icao);
    cdr.markForCheck();
  }

  triggerNewShuffle(facade: ResultsOverlayFacadeCore): void {
    facade.followUi.triggerNewShuffle(
      facade.getSnapshot().highlightedIcao,
      facade.data.filteredSkyPlaneLog
    );
  }
}
