import type { SkyOverlayCtx } from './sky-overlay-private.util';
import type { AtmosphericSkyService } from '../atmospheric-sky/atmospheric-sky.service';

export function updateSkyColorFromAtmosphere(
  ctx: SkyOverlayCtx,
  atmospheric: AtmosphericSkyService,
  sunElevationDegrees: number,
  weatherCondition?: string,
  weatherDescription?: string,
  turbidity = 2.0
): void {
  if (!ctx.gradientDef) return;
  const skyColors = atmospheric.calculateSkyColors(
    sunElevationDegrees,
    weatherCondition,
    weatherDescription,
    turbidity
  );
  const stopElements = ctx.gradientDef.querySelectorAll('stop');
  if (stopElements.length >= 2) {
    stopElements[0].setAttribute('stop-color', skyColors.topColor);
    stopElements[1].setAttribute('stop-color', skyColors.bottomColor);
  }
}

export function setSkyOverlayOpacity(ctx: SkyOverlayCtx, opacity: number): void {
  if (!ctx.skyOverlay) return;
  ctx.skyOverlay.style.opacity = Math.max(0, Math.min(1, opacity)).toString();
}

export function setSkyGradientDirection(
  ctx: SkyOverlayCtx,
  x1 = '0%',
  y1 = '0%',
  x2 = '0%',
  y2 = '100%'
): void {
  if (!ctx.gradientDef) return;
  ctx.gradientDef.setAttribute('x1', x1);
  ctx.gradientDef.setAttribute('y1', y1);
  ctx.gradientDef.setAttribute('x2', x2);
  ctx.gradientDef.setAttribute('y2', y2);
}

export function setSkyGradientStops(
  ctx: SkyOverlayCtx,
  stops: Array<{ offset: string; color: string; opacity?: number }>
): void {
  if (!ctx.gradientDef) return;
  while (ctx.gradientDef.firstChild) {
    ctx.gradientDef.removeChild(ctx.gradientDef.firstChild);
  }
  stops.forEach((stop) => {
    if (!ctx.gradientDef) return;
    const stopElement = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopElement.setAttribute('offset', stop.offset);
    stopElement.setAttribute('stop-color', stop.color);
    if (stop.opacity !== undefined) {
      stopElement.setAttribute('stop-opacity', stop.opacity.toString());
    }
    ctx.gradientDef.appendChild(stopElement);
  });
}

export function setSkySolidColor(ctx: SkyOverlayCtx, color: string): void {
  if (!ctx.skyOverlay) return;
  ctx.skyOverlay.style.fill = color;
}

export function useSkyGradientFill(ctx: SkyOverlayCtx): void {
  if (!ctx.skyOverlay) return;
  ctx.skyOverlay.style.fill = '';
}

export function setSkyOverlayVisible(ctx: SkyOverlayCtx, visible: boolean): void {
  if (!ctx.skyOverlay) return;
  ctx.skyOverlay.style.display = visible ? 'block' : 'none';
}

export function destroySkyOverlay(ctx: SkyOverlayCtx): void {
  if (ctx.skyOverlay && ctx.svgContainer) {
    const backgroundGroup = ctx.svgContainer.querySelector('#sky-background-group');
    if (backgroundGroup?.contains(ctx.skyOverlay)) {
      backgroundGroup.removeChild(ctx.skyOverlay);
    }
    ctx.skyOverlay = null;
  }
  if (ctx.gradientDef && ctx.svgContainer) {
    const defsElement = ctx.svgContainer.querySelector('defs');
    if (defsElement?.contains(ctx.gradientDef)) {
      defsElement.removeChild(ctx.gradientDef);
    }
    ctx.gradientDef = null;
  }
  ctx.map?.off('viewreset zoom move');
  ctx.lastTopColor = '';
  ctx.lastBottomColor = '';
  ctx.currentSkyColors = null;
  ctx.map = null;
  ctx.svgContainer = null;
}
