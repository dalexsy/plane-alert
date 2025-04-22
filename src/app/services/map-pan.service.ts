import { Injectable, OnDestroy } from '@angular/core';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class MapPanService implements OnDestroy {
  private map: L.Map | null = null;
  private keyState = new Map<string, boolean>();
  private animationId: number | null = null;
  private speed = 1000;

  init(map: L.Map, speed: number = 100): void {
    this.map = map;
    this.speed = speed;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.loop();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.map = null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
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
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key;
    if (this.keyState.has(k)) {
      this.keyState.set(k, false);
      e.preventDefault();
    }
  };

  private loop = (): void => {
    if (this.map) {
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
        this.map.panBy([(dx / len) * this.speed, (dy / len) * this.speed], {
          animate: true,
          duration: 0.2,
          easeLinearity: 0.5,
        });
      }
    }
    this.animationId = requestAnimationFrame(this.loop);
  };
}
