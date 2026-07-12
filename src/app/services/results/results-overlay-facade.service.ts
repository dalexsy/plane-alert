import { Injectable } from '@angular/core';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { ResultsOverlayFacadeCore } from './results-overlay-facade.core';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayFacadeService extends ResultsOverlayFacadeCore {
  get filteredSkyPlaneLog(): PlaneLogEntry[] {
    return this.data.filteredSkyPlaneLog;
  }

  get filteredSeenPlaneLog(): PlaneLogEntry[] {
    return this.data.filteredSeenPlaneLog;
  }

  get shuffleMode(): boolean {
    return this.followUi.shuffleMode;
  }

  get nearestMode(): boolean {
    return this.followUi.nearestMode;
  }

  get militaryPriority(): boolean {
    return this.followUi.militaryPriority;
  }

  get skyListScrollable(): boolean {
    return this.scroll.sky.scrollable;
  }

  get skyListAtBottom(): boolean {
    return this.scroll.sky.atBottom;
  }

  set skyListAtBottom(v: boolean) {
    this.scroll.sky.atBottom = v;
  }

  get seenListScrollable(): boolean {
    return this.scroll.seen.scrollable;
  }

  get seenListAtBottom(): boolean {
    return this.scroll.seen.atBottom;
  }

  set seenListAtBottom(v: boolean) {
    this.scroll.seen.atBottom = v;
  }

  get militaryMute(): boolean {
    return this.settings.militaryMute;
  }

  get seenCollapsed(): boolean {
    return this.settings.seenCollapsed;
  }

  get militaryCount(): number {
    return this.data.filteredSkyPlaneLog.filter((p) => p.isMilitary).length;
  }
}
