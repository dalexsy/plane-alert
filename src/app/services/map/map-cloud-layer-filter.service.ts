import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MapCloudLayerFilterService {
  applySkyColorsToCloudLayer(skyColors: {
    bottomColor: string;
    topColor: string;
    timestamp: number;
  }): void {
    const cloudElements = document.querySelectorAll('.cloud-layer');
    cloudElements.forEach((element) => {
      const el = element as HTMLElement;
      const filter = this.createCloudLayerFilter(
        skyColors.bottomColor,
        skyColors.topColor
      );
      el.style.filter = filter;
      el.style.mixBlendMode = 'multiply';
    });
  }

  createCloudLayerFilter(bottomColor: string, topColor: string): string {
    const bottomRgb = this.extractRgbFromColor(bottomColor);
    const topRgb = this.extractRgbFromColor(topColor);
    if (!bottomRgb || !topRgb) return '';

    const avgR = Math.round((bottomRgb.r + topRgb.r) / 2);
    const avgG = Math.round((bottomRgb.g + topRgb.g) / 2);
    const avgB = Math.round((bottomRgb.b + topRgb.b) / 2);
    const brightness = (avgR + avgG + avgB) / (3 * 255);
    const saturation = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
    const hueShift = this.calculateHueShift(avgR, avgG, avgB);
    const saturationAdjust = Math.max(
      0.8,
      Math.min(1.2, 1 + (saturation / 255) * 0.3)
    );
    const brightnessAdjust = Math.max(0.7, Math.min(1.3, brightness * 1.2));
    return `hue-rotate(${hueShift}deg) saturate(${saturationAdjust}) brightness(${brightnessAdjust}) contrast(1.1)`;
  }

  private extractRgbFromColor(
    color: string
  ): { r: number; g: number; b: number } | null {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]),
          g: parseInt(match[1]),
          b: parseInt(match[2]),
        };
      }
    }
    return null;
  }

  private calculateHueShift(r: number, g: number, b: number): number {
    if (r > g && r > b) return -10 + (g / 255) * 20;
    if (b > r && b > g) return 10 - (r / 255) * 20;
    return 0;
  }
}
