import { Injectable, ChangeDetectorRef } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { ResultsOverlayFacadeCore } from './results-overlay-facade.core';

@Injectable({ providedIn: 'root' })
export class ResultsOverlayLifecycleService {
  wire(facade: ResultsOverlayFacadeCore, cdr: ChangeDetectorRef): Subscription[] {
    const subs: Subscription[] = [];
    facade.otherControlsHidden = facade.settings.resultsOverlayControlsHidden;
    subs.push(
      facade.settings.resultsOverlayControlsChanged.subscribe((v) => {
        facade.otherControlsHidden = v;
        cdr.markForCheck();
      })
    );
    facade.collapsed = facade.settings.resultsOverlayCollapsed;
    facade.militaryPrefix.loadPrefixes().then(() => {
      facade.markResultsUpdated();
    });

    subs.push(
      interval(1000).subscribe(() => {
        facade.now = Date.now();
        if (facade.consumeResultsUpdated()) {
          facade.applyPageTitle();
        } else if (facade.data.titleInputsChanged(facade.getSnapshot())) {
          facade.applyPageTitle();
        }
      })
    );

    let prev = 0;
    subs.push(
      facade.scanService.countdown$.subscribe((count) => {
        if (count > prev && prev !== 0) facade.markResultsUpdated();
        prev = count;
      })
    );

    subs.push(
      facade.settings.excludeDiscountChanged.subscribe(() => {
        if (facade.consumeIgnoreNextFilterChange()) return;
        facade.markResultsUpdated();
      })
    );

    facade.markResultsUpdated();
    subs.push(
      facade.planeFollow.followState$.subscribe(() => {
        const m = facade.followCoordinator.getCurrentModes();
        facade.followUi.syncModes(m.shuffle, m.nearest);
        cdr.detectChanges();
      })
    );
    return subs;
  }
}
