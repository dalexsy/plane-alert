import { Injectable, OnDestroy, NgZone } from '@angular/core';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class MapPanService implements OnDestroy {
  constructor(private ngZone: NgZone) {}
  private map: L.Map | null = null;
  private keyState = new Map<string, boolean>();
  private animationId: number | null = null;
  private looping = false; // track if loop is active
  private speed = 1000;

  init(map: L.Map, speed: number = 100): void {
    this.map = map;
    this.speed = speed;
    // Attach listeners and start loop outside Angular to avoid CD
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.onKeyDown, { passive: true });
      window.addEventListener('keyup', this.onKeyUp, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    // Remove listeners outside Angular
    this.ngZone.runOutsideAngular(() => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    });
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.map = null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    // Do not pan when typing in inputs, textareas, selects or contentEditable elements
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable
    ) {
      return;
    }
    const k = e.key;
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'w',
        'W',
        'a',
        'A',
        's',
        'S',
        'd',
        'D',
      ].includes(k)
    ) {
      this.keyState.set(k, true);
      e.preventDefault();
      // start loop if not already running
      if (!this.looping) {
        this.looping = true;
        this.ngZone.runOutsideAngular(() => this.loop());
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable
    ) {
      return;
    }
    const k = e.key;
    if (this.keyState.has(k)) {
      this.keyState.set(k, false);
      e.preventDefault();
    }
  };

  private loop = (): void => {
    if (!this.map) {
      this.looping = false;
      return;
    }
    // Check if any movement keys still pressed
    const moveKeys = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'w',
      'W',
      'a',
      'A',
      's',
      'S',
      'd',
      'D',
    ];
    const hasKey = moveKeys.some((k) => this.keyState.get(k));
    if (!hasKey) {
      this.looping = false;
      this.animationId = null;
      return;
    }
    let dx = 0,
      dy = 0;
    if (
      this.keyState.get('ArrowUp') ||
      this.keyState.get('w') ||
      this.keyState.get('W')
    )
      dy -= 1;
    if (
      this.keyState.get('ArrowDown') ||
      this.keyState.get('s') ||
      this.keyState.get('S')
    )
      dy += 1;
    if (
      this.keyState.get('ArrowLeft') ||
      this.keyState.get('a') ||
      this.keyState.get('A')
    )
      dx -= 1;
    if (
      this.keyState.get('ArrowRight') ||
      this.keyState.get('d') ||
      this.keyState.get('D')
    )
      dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.map.panBy(
        [(dx / len) * this.speed, (dy / len) * this.speed],
        {
          animate: true,
          duration: 0.2,
          easeLinearity: 0.5,
        }
      );
    }
    this.animationId = requestAnimationFrame(this.loop);
  };
}
