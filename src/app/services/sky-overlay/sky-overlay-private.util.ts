/* Extracted from sky-overlay.service.ts — ctx interface avoids private-field access from utils. */
import type { SkyColors } from '../sky-color-sync/sky-color-sync.service';

export interface SkyOverlayCtx {
  map: import('leaflet').Map | null;
  svgContainer: SVGSVGElement | null;
  skyOverlay: SVGRectElement | null;
  gradientDef: SVGLinearGradientElement | null;
  currentSkyColors: SkyColors | null;
  lastTopColor: string;
  lastBottomColor: string;
  updateGradientColors(bottomColor: string, topColor: string): void;
  setDefaultGradient(): void;
  updateSkyOverlay(): void;
  reorderSvgElements(): void;
}

export function setupSvgContainer(ctx: SkyOverlayCtx) {
  if (!ctx.map) return;

  ctx.svgContainer = ctx.map
    .getPanes()
    .overlayPane.querySelector('svg') as SVGSVGElement;

  if (!ctx.svgContainer) {
    console.error('SVG container not found in overlayPane');
  }
}

export function createSkyOverlay(ctx: SkyOverlayCtx) {
  if (!ctx.map || !ctx.svgContainer) return;

  let defsElement = ctx.svgContainer.querySelector('defs');
  if (!defsElement) {
    defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ctx.svgContainer.appendChild(defsElement);
  }

  ctx.gradientDef = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'linearGradient'
  );
  ctx.gradientDef.setAttribute('id', 'skyGradient');
  ctx.gradientDef.setAttribute('x1', '0%');
  ctx.gradientDef.setAttribute('y1', '0%');
  ctx.gradientDef.setAttribute('x2', '0%');
  ctx.gradientDef.setAttribute('y2', '100%');

  const stopTop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopTop.setAttribute('offset', '0%');
  stopTop.setAttribute('stop-opacity', '1');

  const stopBottom = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopBottom.setAttribute('offset', '100%');
  stopBottom.setAttribute('stop-opacity', '1');

  ctx.gradientDef.appendChild(stopTop);
  ctx.gradientDef.appendChild(stopBottom);
  defsElement.appendChild(ctx.gradientDef);

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
    backgroundGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    backgroundGroup.setAttribute('id', 'sky-background-group');
    ctx.svgContainer.insertBefore(backgroundGroup, ctx.svgContainer.firstChild);
    ctx.reorderSvgElements();
  }

  ctx.skyOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  ctx.skyOverlay.classList.add('sky-overlay');
  ctx.skyOverlay.setAttribute('fill', 'url(#skyGradient)');
  backgroundGroup.appendChild(ctx.skyOverlay);
  ctx.updateSkyOverlay();
  ctx.map.on('viewreset zoom move', () => ctx.updateSkyOverlay());
}

export function updateSkyOverlay(ctx: SkyOverlayCtx) {
  if (!ctx.map || !ctx.skyOverlay) return;

  const mapBounds = ctx.map.getBounds();
  const topLeft = ctx.map.latLngToLayerPoint(mapBounds.getNorthWest());
  const bottomRight = ctx.map.latLngToLayerPoint(mapBounds.getSouthEast());

  ctx.skyOverlay.setAttribute('x', topLeft.x.toString());
  ctx.skyOverlay.setAttribute('y', topLeft.y.toString());
  ctx.skyOverlay.setAttribute('width', (bottomRight.x - topLeft.x).toString());
  ctx.skyOverlay.setAttribute('height', (bottomRight.y - topLeft.y).toString());
}

export function updateGradientColors(
  ctx: SkyOverlayCtx,
  bottomColor: string,
  topColor: string
) {
  if (!ctx.gradientDef) {
    console.error(
      '[SKY-OVERLAY] No gradient definition found when trying to update colors'
    );
    return;
  }

  if (ctx.lastTopColor === topColor && ctx.lastBottomColor === bottomColor) {
    return;
  }

  const stops = ctx.gradientDef.querySelectorAll('stop');
  if (stops.length >= 2) {
    const topStop = stops[0] as SVGStopElement;
    const bottomStop = stops[1] as SVGStopElement;

    topStop.setAttribute('stop-color', topColor);
    bottomStop.setAttribute('stop-color', bottomColor);
    topStop.style.setProperty('stop-color', topColor, 'important');
    bottomStop.style.setProperty('stop-color', bottomColor, 'important');

    ctx.lastTopColor = topColor;
    ctx.lastBottomColor = bottomColor;

    if (ctx.skyOverlay) {
      ctx.skyOverlay.removeAttribute('fill');
      requestAnimationFrame(() => {
        ctx.skyOverlay?.setAttribute('fill', 'url(#skyGradient)');
      });
    }
  } else {
    console.error(
      '[SKY-OVERLAY] Gradient does not have enough stop elements:',
      stops.length
    );
  }
}

export function setDefaultGradient(ctx: SkyOverlayCtx) {
  if (!ctx.gradientDef) return;

  const defaultTopColor = '#1c2a4e';
  const defaultBottomColor = '#304069';

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

    topStop.setAttribute('stop-color', defaultTopColor);
    bottomStop.setAttribute('stop-color', defaultBottomColor);
    topStop.style.setProperty('stop-color', defaultTopColor, 'important');
    bottomStop.style.setProperty('stop-color', defaultBottomColor, 'important');

    ctx.lastTopColor = defaultTopColor;
    ctx.lastBottomColor = defaultBottomColor;
  }
}

export function reorderSvgElements(ctx: SkyOverlayCtx) {
  if (!ctx.svgContainer) return;

  const skyBackgroundGroup = ctx.svgContainer.querySelector('#sky-background-group');
  if (!skyBackgroundGroup) return;

  const allChildren = Array.from(ctx.svgContainer.children);
  const elementsToMove = allChildren.filter((child) => {
    if (child.tagName === 'defs' || child.id === 'sky-background-group') {
      return false;
    }
    return true;
  });

  elementsToMove.forEach((element) => {
    ctx.svgContainer!.appendChild(element);
  });
}
