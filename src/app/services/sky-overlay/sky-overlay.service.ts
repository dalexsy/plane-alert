import { Injectable, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AtmosphericSkyService } from '../atmospheric-sky/atmospheric-sky.service';
import { SkyColorSyncService } from '../sky-color-sync/sky-color-sync.service';
import {
  setupSvgContainer as setupSvgContainerImpl,
  createSkyOverlay as createSkyOverlayImpl,
  updateSkyOverlay as updateSkyOverlayImpl,
  updateGradientColors as updateGradientColorsImpl,
  setDefaultGradient as setDefaultGradientImpl,
  reorderSvgElements as reorderSvgElementsImpl,
  type SkyOverlayCtx,
} from './sky-overlay-private.util';
import {
  destroySkyOverlay,
  setSkyGradientDirection,
  setSkyGradientStops,
  setSkyOverlayOpacity,
  setSkyOverlayVisible,
  setSkySolidColor,
  updateSkyColorFromAtmosphere,
  useSkyGradientFill,
} from './sky-overlay-style.util';

@Injectable({ providedIn: 'root' })
export class SkyOverlayService implements OnDestroy {
  map: L.Map | null = null;
  skyOverlay: SVGRectElement | null = null;
  svgContainer: SVGSVGElement | null = null;
  gradientDef: SVGLinearGradientElement | null = null;
  private skyColorsSubscription: Subscription | null = null;
  currentSkyColors: import('../sky-color-sync/sky-color-sync.service').SkyColors | null = null;
  lastTopColor = '';
  lastBottomColor = '';

  constructor(
    private atmosphericSkyService: AtmosphericSkyService,
    private skyColorSyncService: SkyColorSyncService
  ) {
    this.skyColorsSubscription = this.skyColorSyncService.skyColors$
      .pipe(
        debounceTime(100),
        distinctUntilChanged((prev, curr) => {
          if (!prev && !curr) return true;
          if (!prev || !curr) return false;
          return prev.topColor === curr.topColor && prev.bottomColor === curr.bottomColor;
        })
      )
      .subscribe((colors) => {
        this.currentSkyColors = colors;
        if (colors && this.gradientDef) {
          this.updateGradientColors(colors.bottomColor, colors.topColor);
        } else if (!colors && this.gradientDef) {
          this.setDefaultGradient();
        }
      });
  }

  ngOnDestroy(): void {
    this.skyColorsSubscription?.unsubscribe();
  }

  initialize(map: L.Map): void {
    this.map = map;
    setupSvgContainerImpl(this.ctx());
    createSkyOverlayImpl(this.ctx());
  }

  updateSkyOverlay(): void {
    updateSkyOverlayImpl(this.ctx());
  }

  updateSkyColor(
    sunElevationDegrees: number,
    weatherCondition?: string,
    weatherDescription?: string,
    turbidity = 2.0
  ): void {
    updateSkyColorFromAtmosphere(
      this.ctx(),
      this.atmosphericSkyService,
      sunElevationDegrees,
      weatherCondition,
      weatherDescription,
      turbidity
    );
  }

  setOpacity(opacity: number): void {
    setSkyOverlayOpacity(this.ctx(), opacity);
  }

  setGradientDirection(x1?: string, y1?: string, x2?: string, y2?: string): void {
    setSkyGradientDirection(this.ctx(), x1, y1, x2, y2);
  }

  setGradientStops(stops: Array<{ offset: string; color: string; opacity?: number }>): void {
    setSkyGradientStops(this.ctx(), stops);
  }

  setSolidColor(color: string): void {
    setSkySolidColor(this.ctx(), color);
  }

  useGradientFill(): void {
    useSkyGradientFill(this.ctx());
  }

  setVisible(visible: boolean): void {
    setSkyOverlayVisible(this.ctx(), visible);
  }

  updateGradientColors(bottomColor: string, topColor: string): void {
    updateGradientColorsImpl(this.ctx(), bottomColor, topColor);
  }

  setDefaultGradient(): void {
    setDefaultGradientImpl(this.ctx());
  }

  destroy(): void {
    destroySkyOverlay(this.ctx());
  }

  reorderSvgElements(): void {
    reorderSvgElementsImpl(this.ctx());
  }

  ensureProperLayerOrder(): void {
    if (this.svgContainer) this.reorderSvgElements();
  }

  private ctx(): SkyOverlayCtx {
    return this;
  }
}
