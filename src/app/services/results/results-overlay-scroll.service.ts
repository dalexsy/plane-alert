import { Injectable } from '@angular/core';

export interface ScrollFadeState {
  scrollable: boolean;
  atBottom: boolean;
}

@Injectable({ providedIn: 'root' })
export class ResultsOverlayScrollService {
  sky: ScrollFadeState = { scrollable: false, atBottom: false };
  airport: ScrollFadeState = { scrollable: false, atBottom: false };
  seen: ScrollFadeState = { scrollable: false, atBottom: false };

  updateFromElements(refs: {
    sky?: HTMLElement;
    airport?: HTMLElement;
    seen?: HTMLElement;
  }): void {
    const apply = (el: HTMLElement | undefined, key: 'sky' | 'airport' | 'seen') => {
      if (!el) return;
      this[key] = {
        scrollable: el.scrollHeight > el.clientHeight + 2,
        atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
      };
    };
    apply(refs.sky, 'sky');
    apply(refs.airport, 'airport');
    apply(refs.seen, 'seen');
  }

  onScroll(event: Event, key: 'sky' | 'seen'): void {
    const el = event.target as HTMLElement;
    this[key].atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  }
}
