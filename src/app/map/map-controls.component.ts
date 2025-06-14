/**
 * Map Controls Component
 * Handles UI controls and toggles for the map interface
 */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Types for the component interfaces
export interface UIToggles {
  showTrails: boolean;
  showPredictedPaths: boolean;
  showAltitudeColors: boolean;
  showWeather: boolean;
}

export interface EnvironmentalSettings {
  showClouds: boolean;
  showWind: boolean;
  showTemperature: boolean;
}

export interface ToggleChangeEvent {
  key: string;
  value: boolean;
}

export interface SettingChangeEvent {
  key: string;
  value: any;
}

export interface ActionEvent {
  action: string;
  data?: any;
}

@Component({
  selector: 'app-map-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-controls.component.html',
  styleUrls: ['./map-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapControlsComponent {
  @Input() uiToggles: UIToggles | null = null;
  @Input() environmentalSettings: EnvironmentalSettings | null = null;

  @Output() toggleChanged = new EventEmitter<ToggleChangeEvent>();
  @Output() settingChanged = new EventEmitter<SettingChangeEvent>();
  @Output() actionTriggered = new EventEmitter<ActionEvent>();

  onToggleChange(key: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.toggleChanged.emit({ key, value: target.checked });
  }

  onSettingChange(key: string, value: any): void {
    this.settingChanged.emit({ key, value });
  }

  onActionTrigger(action: string, data?: any): void {
    this.actionTriggered.emit({ action, data });
  }
}
