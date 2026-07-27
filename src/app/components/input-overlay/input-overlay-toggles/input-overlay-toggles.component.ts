import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../ui/button/button.component';
import { TabComponent } from '../../ui/tab/tab.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { BrightnessState } from '../../../services/brightness/brightness.service';
import { InputOverlayFacadeService } from '../../../services/input-overlay/input-overlay-facade.service';
import {
  inputOverlayBrightnessIcon,
  inputOverlaySunStatusTooltip,
} from '../../../services/input-overlay/input-overlay-form.util';
import { isKioskMode } from '../../../utils/kiosk-mode/kiosk-mode.util';

@Component({
  selector: 'app-input-overlay-toggles',
  standalone: true,
  imports: [CommonModule, ButtonComponent, TabComponent, TooltipDirective],
  templateUrl: './input-overlay-toggles.component.html',
  styleUrls: ['./input-overlay-toggles.component.scss'],
})
export class InputOverlayTogglesComponent {
  readonly hideMotionControls = isKioskMode();
  @Input() facade!: InputOverlayFacadeService;
  @Input() showDateTime = true;
  @Input() brightnessState: BrightnessState | null = null;
  @Input() showAirportLabels = true;
  @Input() showCloudCover = true;
  @Input() showRainCover = true;
  @Input() showViewAxes = false;
  @Input() animationsEnabled = true;
  @Input() showGhostPosition = false;

  @Output() toggleOtherControls = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() toggleDateTimeOverlays = new EventEmitter<void>();
  @Output() brightnessToggle = new EventEmitter<void>();
  @Output() toggleAirportLabels = new EventEmitter<void>();
  @Output() cloudToggleChange = new EventEmitter<boolean>();
  @Output() rainToggleChange = new EventEmitter<boolean>();
  @Output() coneVisibilityChange = new EventEmitter<boolean>();
  @Output() coneConfigChange = new EventEmitter<void>();
  @Output() animationsEnabledChange = new EventEmitter<boolean>();
  @Output() ghostPositionChange = new EventEmitter<boolean>();
  @Output() goToHome = new EventEmitter<void>();
  @Output() resolveAndUpdate = new EventEmitter<Event>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();

  get brightnessIcon(): string {
    return inputOverlayBrightnessIcon(this.brightnessState);
  }

  get sunStatusTooltip(): string {
    return inputOverlaySunStatusTooltip(this.brightnessState);
  }

  get collapseTooltip(): string {
    return this.facade.collapsed ? 'Expand options' : 'Collapse options';
  }

  get dateTimeTooltip(): string {
    return this.showDateTime ? 'Hide date/time' : 'Show date/time';
  }

  get airportLabelsTooltip(): string {
    return this.showAirportLabels ? 'Hide airport labels' : 'Show airport labels';
  }

  get cloudCoverTooltip(): string {
    return this.showCloudCover ? 'Hide cloud cover' : 'Show cloud cover';
  }

  get rainCoverTooltip(): string {
    return this.showRainCover ? 'Hide rain cover' : 'Show rain cover';
  }

  get viewAxesTooltip(): string {
    return this.showViewAxes ? 'Hide view axes' : 'Show view axes';
  }

  get animationsTooltip(): string {
    return this.animationsEnabled ? 'Disable animations' : 'Enable animations';
  }

  get ghostPositionTooltip(): string {
    return this.showGhostPosition
      ? 'Hide ghost at last reported position'
      : 'Show ghost at last reported position (onion skin while motion is faked)';
  }

  onToggleAnimations(): void {
    this.animationsEnabledChange.emit(!this.animationsEnabled);
  }

  onToggleGhostPosition(): void {
    this.ghostPositionChange.emit(!this.showGhostPosition);
  }
}
