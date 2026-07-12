import { Injectable, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { WindowViewPlane } from '../../types/window-view-plane';
import { AltitudeColorService } from '../altitude-color/altitude-color.service';
import { OperatorTooltipService } from '../operator-tooltip/operator-tooltip.service';
import { TextUtils } from '../../utils/text-utils/text-utils';

@Injectable({ providedIn: 'root' })
export class AircraftContainerFacadeService implements OnDestroy {
  private altitudeBorderCache = new Map<string, { [key: string]: string }>();
  private labelClassCache = new Map<string, string>();
  private readonly maxCacheSize = 1000;
  private currentOperatorTooltip: HTMLElement | null = null;

  constructor(
    public altitudeColor: AltitudeColorService,
    public operatorTooltipService: OperatorTooltipService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnDestroy(): void {
    this.hideOperatorTooltip();
  }

  clearCaches(): void {
    this.altitudeBorderCache.clear();
    this.labelClassCache.clear();
  }

  trackByPlaneIcao(_index: number, plane: WindowViewPlane): string {
    return plane.icao || plane.callsign || `${_index}`;
  }

  getAltitudeBorderStyle(plane: WindowViewPlane, showBorders: boolean): Record<string, string> {
    if (!showBorders || !plane.altitude) return {};
    const cacheKey = `${plane.icao}-${plane.altitude}`;
    const cached = this.altitudeBorderCache.get(cacheKey);
    if (cached) return cached;
    const result = { 'border-color': this.altitudeColor.getFillColor(plane.altitude) };
    this.altitudeBorderCache.set(cacheKey, result);
    this.trimCache(this.altitudeBorderCache);
    return result;
  }

  getLabelClasses(
    plane: WindowViewPlane,
    highlightedIcao: string | null,
    showAltitudeBorders: boolean
  ): string {
    const hasDetails =
      plane.distanceKm != null &&
      plane.distanceKm <= 10 &&
      !plane.isGrounded &&
      !!(plane.operator || plane.model || (plane.distanceKm != null && plane.distanceKm <= 3));
    const isFollowed = plane.icao === highlightedIcao;
    const hasAltitudeBorder = hasDetails && showAltitudeBorders && !!plane.altitude;
    const cacheKey = `${plane.icao}-${isFollowed}-${hasDetails}-${hasAltitudeBorder}`;
    const cached = this.labelClassCache.get(cacheKey);
    if (cached) return cached;
    const classes: string[] = [];
    if (isFollowed) classes.push('followed');
    if (hasDetails) {
      classes.push('has-details');
      if (hasAltitudeBorder) classes.push('altitude-bordered-tooltip');
    }
    const result = classes.join(' ');
    this.labelClassCache.set(cacheKey, result);
    this.trimCache(this.labelClassCache);
    return result;
  }

  truncateOperator(operator: string | undefined): string {
    return TextUtils.truncateOperator(operator);
  }

  shouldShowOperatorLogo(plane: WindowViewPlane): boolean {
    return (
      this.operatorTooltipService.getSymbolConfig(this.planeData(plane)) !== null
    );
  }

  getOperatorLogoContent(plane: WindowViewPlane): SafeHtml {
    const html = this.operatorTooltipService.getLeftTooltipContent(
      this.planeData(plane)
    );
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onMouseEnter(plane: WindowViewPlane, event: MouseEvent): void {
    if (this.shouldShowOperatorLogo(plane)) {
      this.showOperatorTooltip(plane, event.currentTarget as HTMLElement);
    }
  }

  hideOperatorTooltip(): void {
    if (this.currentOperatorTooltip?.parentNode) {
      this.currentOperatorTooltip.parentNode.removeChild(
        this.currentOperatorTooltip
      );
    }
    this.currentOperatorTooltip = null;
  }

  private showOperatorTooltip(
    plane: WindowViewPlane,
    planeElement: HTMLElement
  ): void {
    this.hideOperatorTooltip();
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'operator-logo-tooltip operator-logo-tooltip-fixed';
    tooltipEl.innerHTML = this.getOperatorLogoContent(plane).toString();
    const rect = planeElement.getBoundingClientRect();
    const tooltipHeight = 70;
    const tooltipWidth = 70;
    const margin = 8;
    let left = rect.left + rect.width / 2;
    let top = rect.top - tooltipHeight;
    if (left + tooltipWidth / 2 > window.innerWidth) {
      left = window.innerWidth - tooltipWidth / 2 - margin;
    }
    if (left - tooltipWidth / 2 < margin) left = tooltipWidth / 2 + margin;
    if (top < margin) top = rect.bottom + margin;
    if (top + tooltipHeight > window.innerHeight) {
      top = window.innerHeight - tooltipHeight - margin;
    }
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.transform = 'translateX(-50%)';
    tooltipEl.style.zIndex = '1004';
    const overlay = document.querySelector('.window-view-overlay');
    (overlay ?? document.body).appendChild(tooltipEl);
    this.currentOperatorTooltip = tooltipEl;
  }

  private planeData(plane: WindowViewPlane) {
    return {
      operator: plane.operator || '',
      origin: plane.origin || '',
      isMilitary: plane.isMilitary || false,
      callsign: plane.callsign || '',
      icao: plane.icao || '',
      lat: plane.lat,
      lon: plane.lon,
    };
  }

  private trimCache<K, V>(cache: Map<K, V>): void {
    if (cache.size <= this.maxCacheSize) return;
    const remove = Math.floor(this.maxCacheSize * 0.2);
    const keys = Array.from(cache.keys());
    for (let i = 0; i < remove; i++) cache.delete(keys[i]);
  }
}
