import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MobileOverlayService {
  // True if overlays should be collapsed (mobile)
  private _collapseInputOverlay = new BehaviorSubject<boolean>(false);
  private _collapseResultsOverlay = new BehaviorSubject<boolean>(false);

  collapseInputOverlay$ = this._collapseInputOverlay.asObservable();
  collapseResultsOverlay$ = this._collapseResultsOverlay.asObservable();

  constructor(private ngZone: NgZone) {
    this.checkMobileAndSetCollapse();
    window.addEventListener('resize', () => {
      this.ngZone.run(() => this.checkMobileAndSetCollapse());
    });
  }

  private checkMobileAndSetCollapse() {
    const isMobile = window.innerWidth <= 768;
    this._collapseInputOverlay.next(isMobile);
    this._collapseResultsOverlay.next(isMobile);
  }

  // Optionally allow manual override
  setCollapseInputOverlay(value: boolean) {
    this._collapseInputOverlay.next(value);
  }
  setCollapseResultsOverlay(value: boolean) {
    this._collapseResultsOverlay.next(value);
  }
}
