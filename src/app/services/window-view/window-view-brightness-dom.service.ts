import { Injectable } from '@angular/core';
import { ElementRef } from '@angular/core';
import type { BrightnessState } from '../brightness.service';

const WINDOW_DIM_FACTOR = 0.5;

@Injectable({ providedIn: 'root' })
export class WindowViewBrightnessDomService {
  applyBrightness(elRef: ElementRef, brightnessState: BrightnessState | null): void {
    if (!brightnessState) {
      return;
    }
    const windowViewElement = elRef.nativeElement?.querySelector(
      '.window-view-overlay'
    );
    if (!windowViewElement) {
      return;
    }
    const originalBrightness = brightnessState.brightness;
    const isDimming = brightnessState.isDimming;
    const adjustedBrightness =
      1 - (1 - originalBrightness) * WINDOW_DIM_FACTOR;
    let filterString = `brightness(${adjustedBrightness})`;
    if (isDimming) {
      const dimAmount = 1 - adjustedBrightness;
      const contrastValue = 1 + dimAmount * 0.05;
      const saturationValue = 1 - dimAmount * 0.1;
      filterString += ` contrast(${contrastValue}) saturate(${saturationValue})`;
      if (originalBrightness < 0.1) {
        filterString += ` hue-rotate(2deg)`;
      }
    }
    (windowViewElement as HTMLElement).style.filter = filterString;
    this.updateDarkOverlay(windowViewElement as HTMLElement, originalBrightness);
  }

  private updateDarkOverlay(
    windowViewElement: HTMLElement,
    brightness: number
  ): void {
    let darkOverlay = windowViewElement.querySelector(
      '.brightness-dark-overlay'
    ) as HTMLElement | null;
    if (brightness < 0.1) {
      if (!darkOverlay) {
        darkOverlay = document.createElement('div');
        darkOverlay.className = 'brightness-dark-overlay';
        darkOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          pointer-events: none;
          z-index: 1000;
          transition: opacity 0.5s ease-in-out;
        `;
        windowViewElement.appendChild(darkOverlay);
      }
      const baseOpacity = Math.max(0, (0.1 - brightness) / 0.1) * 0.4;
      darkOverlay.style.opacity = (baseOpacity * WINDOW_DIM_FACTOR).toString();
    } else if (darkOverlay) {
      darkOverlay.style.opacity = '0';
      setTimeout(() => {
        if (darkOverlay?.parentNode) {
          darkOverlay.parentNode.removeChild(darkOverlay);
        }
      }, 500);
    }
  }
}
