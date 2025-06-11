import { Injectable, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AtmosphericSkyService } from './atmospheric-sky.service';
import { SkyColorSyncService, SkyColors } from './sky-color-sync.service';

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
  private setupSvgContainer(): void {
    if (!this.map) return;

    // Use the existing overlayPane SVG like the cone component does
    this.svgContainer = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;

    if (!this.svgContainer) {
      console.error('SVG container not found in overlayPane');
      return;
    }
  }
  /**
   * Create SVG rectangle overlay covering the entire map view
   */
  private createSkyOverlay(): void {
    if (!this.map || !this.svgContainer) return;

    // Create or get the defs element for gradients
    let defsElement = this.svgContainer.querySelector('defs');
    if (!defsElement) {
      defsElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      this.svgContainer.appendChild(defsElement);
    } // Create the gradient definition
    this.gradientDef = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'linearGradient'
    );
    this.gradientDef.setAttribute('id', 'skyGradient');
    this.gradientDef.setAttribute('x1', '0%');
    this.gradientDef.setAttribute('y1', '0%');
    this.gradientDef.setAttribute('x2', '0%');
    this.gradientDef.setAttribute('y2', '100%'); // Create gradient stops with initial colors that will be updated
    const stopTop = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop'
    );
    stopTop.setAttribute('offset', '0%');
    stopTop.setAttribute('stop-opacity', '1');

    const stopBottom = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop'
    );
    stopBottom.setAttribute('offset', '100%');
    stopBottom.setAttribute('stop-opacity', '1');

    this.gradientDef.appendChild(stopTop);
    this.gradientDef.appendChild(stopBottom);
    defsElement.appendChild(this.gradientDef);

    // Apply current sky colors if available, otherwise use defaults
    if (this.currentSkyColors) {
      this.updateGradientColors(
        this.currentSkyColors.bottomColor,
        this.currentSkyColors.topColor
      );
    } else {
      this.setDefaultGradient();
    }

    let backgroundGroup = this.svgContainer.querySelector(
      '#sky-background-group'
    ) as SVGGElement;
    if (!backgroundGroup) {
      backgroundGroup = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      backgroundGroup.setAttribute('id', 'sky-background-group');
      // Insert the background group at the very beginning
      this.svgContainer.insertBefore(
        backgroundGroup,
        this.svgContainer.firstChild
      );

      // Force sky background to stay at the beginning by moving all other groups after it
      this.reorderSvgElements();
    } // Create the sky overlay rectangle
    this.skyOverlay = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );
    this.skyOverlay.classList.add('sky-overlay');
    this.skyOverlay.setAttribute('fill', 'url(#skyGradient)'); // Explicitly set fill

    // Add the sky overlay to the background group
    backgroundGroup.appendChild(this.skyOverlay);

    // Initial positioning
    this.updateSkyOverlay();

    // Update on map move/zoom
    this.map.on('viewreset zoom move', () => this.updateSkyOverlay());
  }

  /**
   * Update sky overlay position and size when map view changes
   */
  private updateSkyOverlay(): void {
    if (!this.map || !this.skyOverlay) return;

    // Get updated map bounds in pixel coordinates
    const mapBounds = this.map.getBounds();
    const topLeft = this.map.latLngToLayerPoint(mapBounds.getNorthWest());
    const bottomRight = this.map.latLngToLayerPoint(mapBounds.getSouthEast());

    // Update rectangle attributes
    this.skyOverlay.setAttribute('x', topLeft.x.toString());
    this.skyOverlay.setAttribute('y', topLeft.y.toString());
    this.skyOverlay.setAttribute(
      'width',
      (bottomRight.x - topLeft.x).toString()
    );
    this.skyOverlay.setAttribute(
      'height',
      (bottomRight.y - topLeft.y).toString()
    );
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
  private updateGradientColors(bottomColor: string, topColor: string): void {
    if (!this.gradientDef) {
      console.error(
        '[SKY-OVERLAY] No gradient definition found when trying to update colors'
      );
      return;
    }

    // Skip update if colors haven't changed
    if (
      this.lastTopColor === topColor &&
      this.lastBottomColor === bottomColor
    ) {
      return;
    }

    const stops = this.gradientDef.querySelectorAll('stop');
    if (stops.length >= 2) {
      // Update both SVG attributes and CSS styles to override SCSS
      const topStop = stops[0] as SVGStopElement;
      const bottomStop = stops[1] as SVGStopElement;

      // Set SVG attributes
      topStop.setAttribute('stop-color', topColor);
      bottomStop.setAttribute('stop-color', bottomColor);

      // Also set CSS styles to override any SCSS rules
      topStop.style.setProperty('stop-color', topColor, 'important');
      bottomStop.style.setProperty('stop-color', bottomColor, 'important');

      // Update tracking variables
      this.lastTopColor = topColor;
      this.lastBottomColor = bottomColor;

      // Force a repaint by recreating the gradient reference
      if (this.skyOverlay) {
        // Temporarily remove fill, then set it back to force SVG engine to re-evaluate
        this.skyOverlay.removeAttribute('fill');
        requestAnimationFrame(() => {
          if (this.skyOverlay) {
            this.skyOverlay.setAttribute('fill', 'url(#skyGradient)');
          }
        });
      }
    } else {
      console.error(
        '[SKY-OVERLAY] Gradient does not have enough stop elements:',
        stops.length
      );
    }
  }
  /**
   * Set default gradient when atmospheric colors are not available
   */
  private setDefaultGradient(): void {
    if (!this.gradientDef) return;

    const defaultTopColor = '#1c2a4e'; // Dark atmospheric blue at top
    const defaultBottomColor = '#304069'; // Lighter atmospheric blue at bottom

    // Skip update if already using default colors
    if (
      this.lastTopColor === defaultTopColor &&
      this.lastBottomColor === defaultBottomColor
    ) {
      return;
    }

    const stops = this.gradientDef.querySelectorAll('stop');
    if (stops.length >= 2) {
      const topStop = stops[0] as SVGStopElement;
      const bottomStop = stops[1] as SVGStopElement;

      // Set both SVG attributes and CSS styles
      topStop.setAttribute('stop-color', defaultTopColor);
      bottomStop.setAttribute('stop-color', defaultBottomColor);

      topStop.style.setProperty('stop-color', defaultTopColor, 'important');
      bottomStop.style.setProperty(
        'stop-color',
        defaultBottomColor,
        'important'
      );

      // Update tracking variables
      this.lastTopColor = defaultTopColor;
      this.lastBottomColor = defaultBottomColor;
    }
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
  private reorderSvgElements(): void {
    if (!this.svgContainer) return;

    const skyBackgroundGroup = this.svgContainer.querySelector(
      '#sky-background-group'
    );
    if (!skyBackgroundGroup) return;

    // Get all direct child elements (groups and other elements)
    const allChildren = Array.from(this.svgContainer.children);

    // Find elements that should come after the sky background
    const elementsToMove = allChildren.filter((child) => {
      // Keep defs and sky background group at the beginning
      if (child.tagName === 'defs' || child.id === 'sky-background-group') {
        return false;
      }
      return true;
    });

    // Move all other elements after the sky background group
    elementsToMove.forEach((element) => {
      this.svgContainer!.appendChild(element);
    });
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
