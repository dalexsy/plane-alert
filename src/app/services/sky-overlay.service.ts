import { Injectable, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AtmosphericSkyService } from './atmospheric-sky.service';
import { SkyColorSyncService, SkyColors } from './sky-color-sync.service';
import { setupSvgContainer as setupSvgContainerImpl, createSkyOverlay as createSkyOverlayImpl, updateSkyOverlay as updateSkyOverlayImpl, updateGradientColors as updateGradientColorsImpl, setDefaultGradient as setDefaultGradientImpl, reorderSvgElements as reorderSvgElementsImpl } from './sky-overlay/sky-overlay-private.util';

/**
 * Service for managing the sky color overlay on the Leaflet map
 * Creates a tinted layer that blends with the map tiles to simulate atmospheric conditions
 * Uses the same atmospheric sky colors as the window view overlay
 */
@Injectable({
  providedIn: 'root',
})
export class SkyOverlayService implements OnDestroy {
  private map: L.Map | null = null;
  private skyOverlay: SVGRectElement | null = null;
  private svgContainer: SVGSVGElement | null = null;
  private gradientDef: SVGLinearGradientElement | null = null;
  private skyColorsSubscription: Subscription | null = null;
  private currentSkyColors: SkyColors | null = null;
  private lastTopColor: string = '';
  private lastBottomColor: string = '';

  constructor(
    private atmosphericSkyService: AtmosphericSkyService,
    private skyColorSyncService: SkyColorSyncService
  ) {
    // Subscribe to sky color changes from window overlay with debouncing
    this.skyColorsSubscription = this.skyColorSyncService.skyColors$
      .pipe(
        debounceTime(100), // Debounce rapid updates
        distinctUntilChanged((prev, curr) => {
          // Only update if colors actually changed
          if (!prev && !curr) return true;
          if (!prev || !curr) return false;
          return (
            prev.topColor === curr.topColor &&
            prev.bottomColor === curr.bottomColor
          );
        })
      )
      .subscribe((colors) => {
        this.currentSkyColors = colors;
        if (colors && this.gradientDef) {
          this.updateGradientColors(colors.bottomColor, colors.topColor);
        } else if (!colors && this.gradientDef) {
          // Fall back to default gradient when window overlay is not available
          this.setDefaultGradient();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.skyColorsSubscription) {
      this.skyColorsSubscription.unsubscribe();
    }
  }

  /**
   * Initialize the sky overlay service with the map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
    this.setupSvgContainer();
    this.createSkyOverlay();
  }

  /**
   * Use the existing overlayPane SVG (like cone component does)
   */
  private setupSvgContainer() {
    return setupSvgContainerImpl(this);
  }
  /**
   * Create SVG rectangle overlay covering the entire map view
   */
  private createSkyOverlay() {
    return createSkyOverlayImpl(this);
  }

  /**
   * Update sky overlay position and size when map view changes
   */
  private updateSkyOverlay() {
    return updateSkyOverlayImpl(this);
  }
  /**
   * Update the sky overlay color based on atmospheric conditions
   */
  updateSkyColor(
    sunElevationDegrees: number,
    weatherCondition?: string,
    weatherDescription?: string,
    turbidity: number = 2.0
  ): void {
    if (!this.gradientDef) return;

    const skyColors = this.atmosphericSkyService.calculateSkyColors(
      sunElevationDegrees,
      weatherCondition,
      weatherDescription,
      turbidity
    );

    // Update gradient stops with atmospheric sky colors
    const stopElements = this.gradientDef.querySelectorAll('stop');
    if (stopElements.length >= 2) {
      // Top of sky (zenith)
      stopElements[0].setAttribute('stop-color', skyColors.topColor);
      // Bottom of sky (horizon)
      stopElements[1].setAttribute('stop-color', skyColors.bottomColor);
    }
  }
  /**
   * Set the sky overlay opacity
   */
  setOpacity(opacity: number): void {
    if (!this.skyOverlay) return;
    // Use CSS style instead of SVG attribute for better SCSS integration
    this.skyOverlay.style.opacity = Math.max(
      0,
      Math.min(1, opacity)
    ).toString();
  }

  /**
   * Configure gradient direction and intensity
   */
  setGradientDirection(
    x1: string = '0%',
    y1: string = '0%',
    x2: string = '0%',
    y2: string = '100%'
  ): void {
    if (!this.gradientDef) return;

    this.gradientDef.setAttribute('x1', x1);
    this.gradientDef.setAttribute('y1', y1);
    this.gradientDef.setAttribute('x2', x2);
    this.gradientDef.setAttribute('y2', y2);
  }

  /**
   * Add multiple gradient stops for complex sky effects
   */
  setGradientStops(
    stops: Array<{ offset: string; color: string; opacity?: number }>
  ): void {
    if (!this.gradientDef) return;

    // Clear existing stops
    while (this.gradientDef.firstChild) {
      this.gradientDef.removeChild(this.gradientDef.firstChild);
    } // Add new stops
    stops.forEach((stop) => {
      if (!this.gradientDef) return; // Additional null check for safety

      const stopElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'stop'
      );
      stopElement.setAttribute('offset', stop.offset);
      stopElement.setAttribute('stop-color', stop.color);
      if (stop.opacity !== undefined) {
        stopElement.setAttribute('stop-opacity', stop.opacity.toString());
      }
      this.gradientDef.appendChild(stopElement);
    });
  }
  /**
   * Set solid color (single color overlay without gradient)
   */
  setSolidColor(color: string): void {
    if (!this.skyOverlay) return;
    // Use CSS style instead of SVG attribute
    this.skyOverlay.style.fill = color;
  }

  /**
   * Reset to gradient fill after using solid color
   */
  useGradientFill(): void {
    if (!this.skyOverlay) return;
    // Remove inline style to let SCSS take over
    this.skyOverlay.style.fill = '';
  }
  /**
   * Show or hide the sky overlay
   */
  setVisible(visible: boolean): void {
    if (!this.skyOverlay) return;
    this.skyOverlay.style.display = visible ? 'block' : 'none';
  }
  /**
   * Update gradient colors with atmospheric sky colors from window overlay
   */
  private updateGradientColors(bottomColor: string, topColor: string) {
    return updateGradientColorsImpl(this, bottomColor: string, topColor: string);
  }
  /**
   * Set default gradient when atmospheric colors are not available
   */
  private setDefaultGradient() {
    return setDefaultGradientImpl(this);
  }
  /**
   * Clean up the overlay when the service is destroyed
   */
  destroy(): void {
    if (this.skyOverlay && this.svgContainer) {
      const backgroundGroup = this.svgContainer.querySelector(
        '#sky-background-group'
      );
      if (backgroundGroup && backgroundGroup.contains(this.skyOverlay)) {
        backgroundGroup.removeChild(this.skyOverlay);
      }
      this.skyOverlay = null;
    }

    if (this.gradientDef && this.svgContainer) {
      const defsElement = this.svgContainer.querySelector('defs');
      if (defsElement && defsElement.contains(this.gradientDef)) {
        defsElement.removeChild(this.gradientDef);
      }
      this.gradientDef = null;
    }

    if (this.map) {
      this.map.off('viewreset zoom move');
    }

    // Reset tracking variables
    this.lastTopColor = '';
    this.lastBottomColor = '';
    this.currentSkyColors = null;

    this.map = null;
    this.svgContainer = null;
  }

  /**
   * Reorder SVG elements to ensure sky background group stays at the beginning
   * This method moves all non-sky groups after the sky background group
   */
  private reorderSvgElements() {
    return reorderSvgElementsImpl(this);
  }

  /**
   * Ensure sky overlay remains behind other elements
   * Call this method after adding new elements to the SVG
   */
  ensureProperLayerOrder(): void {
    if (!this.svgContainer) return;

    this.reorderSvgElements();
  }
}
