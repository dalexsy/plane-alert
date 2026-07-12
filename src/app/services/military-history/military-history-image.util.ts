import { ChangeDetectorRef } from '@angular/core';
import {
  AircraftImageService,
  type AircraftImage,
} from '../aircraft-image/aircraft-image.service';
import type { MilitaryHistorySighting } from './military-history.service';
import { isGenericHistoryModel } from './military-history-display.util';

export class MilitaryHistoryImageTooltip {
  showImageTooltip = false;
  isLoadingImage = false;
  aircraftImage: AircraftImage | null = null;
  tooltipPosition = { x: 0, y: 0 };
  private imageLoadTimeout?: number;

  constructor(
    private aircraftImageService: AircraftImageService,
    private cdr: ChangeDetectorRef,
  ) {}

  onModelMouseEnter(event: MouseEvent, sighting: MilitaryHistorySighting) {
    if (!sighting.model || isGenericHistoryModel(sighting.model)) return;
    this.tooltipPosition = { x: event.clientX, y: event.clientY };
    this.showImageTooltip = true;
    this.isLoadingImage = true;
    this.aircraftImage = null;
    if (this.imageLoadTimeout) clearTimeout(this.imageLoadTimeout);
    this.imageLoadTimeout = window.setTimeout(() => {
      this.aircraftImageService
        .getAircraftImage(sighting.model!, sighting.registration)
        .subscribe({
          next: (image) => {
            if (!this.showImageTooltip) return;
            this.aircraftImage = image;
            this.isLoadingImage = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.aircraftImage = null;
            this.isLoadingImage = false;
            this.cdr.detectChanges();
          },
        });
    }, 300);
  }

  onModelMouseLeave() {
    if (this.imageLoadTimeout) clearTimeout(this.imageLoadTimeout);
    this.showImageTooltip = false;
    this.isLoadingImage = false;
    this.aircraftImage = null;
    this.cdr.detectChanges();
  }
}