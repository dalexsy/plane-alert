/* Extracted from sky-overlay.service.ts */
import type { SkyOverlayService } from '../sky-overlay.service';

export type Ctx = SkyOverlayService;

export function setupSvgContainer(ctx: Ctx) {
    if (!ctx.map) return;

    // Use the existing overlayPane SVG like the cone component does
    ctx.svgContainer = ctx.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;

    if (!ctx.svgContainer) {
      console.error('SVG container not found in overlayPane');
      return;
    }
}

export function createSkyOverlay(ctx: Ctx) {
    if (!ctx.map || !ctx.svgContainer) return;

    // Create or get the defs element for gradients
    let defsElement = ctx.svgContainer.querySelector('defs');
    if (!defsElement) {
      defsElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      ctx.svgContainer.appendChild(defsElement);
    } // Create the gradient definition
    ctx.gradientDef = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'linearGradient'
    );
    ctx.gradientDef.setAttribute('id', 'skyGradient');
    ctx.gradientDef.setAttribute('x1', '0%');
    ctx.gradientDef.setAttribute('y1', '0%');
    ctx.gradientDef.setAttribute('x2', '0%');
    ctx.gradientDef.setAttribute('y2', '100%'); // Create gradient stops with initial colors that will be updated
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

    ctx.gradientDef.appendChild(stopTop);
    ctx.gradientDef.appendChild(stopBottom);
    defsElement.appendChild(ctx.gradientDef);

    // Apply current sky colors if available, otherwise use defaults
    if (ctx.currentSkyColors) {
      ctx.updateGradientColors(
        ctx.currentSkyColors.bottomColor,
        ctx.currentSkyColors.topColor
      );
    } else {
      ctx.setDefaultGradient();
    }

    let backgroundGroup = ctx.svgContainer.querySelector(
      '#sky-background-group'
    ) as SVGGElement;
    if (!backgroundGroup) {
      backgroundGroup = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      backgroundGroup.setAttribute('id', 'sky-background-group');
      // Insert the background group at the very beginning
      ctx.svgContainer.insertBefore(
        backgroundGroup,
        ctx.svgContainer.firstChild
      );

      // Force sky background to stay at the beginning by moving all other groups after it
      ctx.reorderSvgElements();
    } // Create the sky overlay rectangle
    ctx.skyOverlay = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );
    ctx.skyOverlay.classList.add('sky-overlay');
    ctx.skyOverlay.setAttribute('fill', 'url(#skyGradient)'); // Explicitly set fill

    // Add the sky overlay to the background group
    backgroundGroup.appendChild(ctx.skyOverlay);

    // Initial positioning
    ctx.updateSkyOverlay();

    // Update on map move/zoom
    ctx.map.on('viewreset zoom move', () => ctx.updateSkyOverlay());
}

export function updateSkyOverlay(ctx: Ctx) {
    if (!ctx.map || !ctx.skyOverlay) return;

    // Get updated map bounds in pixel coordinates
    const mapBounds = ctx.map.getBounds();
    const topLeft = ctx.map.latLngToLayerPoint(mapBounds.getNorthWest());
    const bottomRight = ctx.map.latLngToLayerPoint(mapBounds.getSouthEast());

    // Update rectangle attributes
    ctx.skyOverlay.setAttribute('x', topLeft.x.toString());
    ctx.skyOverlay.setAttribute('y', topLeft.y.toString());
    ctx.skyOverlay.setAttribute(
      'width',
      (bottomRight.x - topLeft.x).toString()
    );
    ctx.skyOverlay.setAttribute(
      'height',
      (bottomRight.y - topLeft.y).toString()
    );
}

export function updateGradientColors(ctx: Ctx, bottomColor: string, topColor: string) {
    if (!ctx.gradientDef) {
      console.error(
        '[SKY-OVERLAY] No gradient definition found when trying to update colors'
      );
      return;
    }

    // Skip update if colors haven't changed
    if (
      ctx.lastTopColor === topColor &&
      ctx.lastBottomColor === bottomColor
    ) {
      return;
    }

    const stops = ctx.gradientDef.querySelectorAll('stop');
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
      ctx.lastTopColor = topColor;
      ctx.lastBottomColor = bottomColor;

      // Force a repaint by recreating the gradient reference
      if (ctx.skyOverlay) {
        // Temporarily remove fill, then set it back to force SVG engine to re-evaluate
        ctx.skyOverlay.removeAttribute('fill');
        requestAnimationFrame(() => {
          if (ctx.skyOverlay) {
            ctx.skyOverlay.setAttribute('fill', 'url(#skyGradient)');
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

export function setDefaultGradient(ctx: Ctx) {
    if (!ctx.gradientDef) return;

    const defaultTopColor = '#1c2a4e'; // Dark atmospheric blue at top
    const defaultBottomColor = '#304069'; // Lighter atmospheric blue at bottom

    // Skip update if already using default colors
    if (
      ctx.lastTopColor === defaultTopColor &&
      ctx.lastBottomColor === defaultBottomColor
    ) {
      return;
    }

    const stops = ctx.gradientDef.querySelectorAll('stop');
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
      ctx.lastTopColor = defaultTopColor;
      ctx.lastBottomColor = defaultBottomColor;
    }
}

export function reorderSvgElements(ctx: Ctx) {
    if (!ctx.svgContainer) return;

    const skyBackgroundGroup = ctx.svgContainer.querySelector(
      '#sky-background-group'
    );
    if (!skyBackgroundGroup) return;

    // Get all direct child elements (groups and other elements)
    const allChildren = Array.from(ctx.svgContainer.children);

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
      ctx.svgContainer!.appendChild(element);
    });
}
