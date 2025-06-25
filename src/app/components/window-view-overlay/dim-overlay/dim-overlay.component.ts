import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrightnessState } from '../../../services/brightness.service';

export interface DimSegment {
  left: number;
  width: number;
}

@Component({
  selector: 'app-dim-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dim-overlay.component.html',
  styleUrl: './dim-overlay.component.scss',
})
export class DimOverlayComponent {
  @Input() dimSegments: DimSegment[] = [];
  @Input() brightnessState: BrightnessState | null = null;

  /** Window view dimming intensity factor - reduces dimming compared to main map */
  private readonly WINDOW_DIM_FACTOR = 0.5;

  /**
   * Get dynamic dim opacity based on brightness state
   * Uses reduced intensity for window view dimming
   */
  getDimOpacity(): number {
    if (!this.brightnessState) {
      return 0.15; // Reduced default opacity
    }

    // Apply reduced dimming intensity for window view
    const baseOpacity = 0.1; // Lower base opacity
    const originalBrightness = this.brightnessState.brightness;
    const brightnessEffect =
      (1 - originalBrightness) * 0.2 * this.WINDOW_DIM_FACTOR;

    return Math.min(0.35, baseOpacity + brightnessEffect); // Lower maximum opacity
  }
}
