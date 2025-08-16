import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-angle-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './angle-overlay.component.html',
  styleUrls: ['./angle-overlay.component.scss'],
})
export class AngleOverlayComponent {
  @Input() sunAngle!: number;
  @Input() sunEventText!: string;
  @Input() isNight!: boolean;
  @Input() moonPhaseName!: string;
  @Input() moonFraction!: number;
  @Input() windAngle!: number;
  @Input() windStat!: number;
  @Input() windSpeed!: number;
  @Input() windUnit!: string;
  @Input() windDirection!: string;
  @Input() showWindDirection: boolean = true;
  @Input() showSunDirection: boolean = true;

  @Output() cycleWindUnit = new EventEmitter<void>();
  // No dynamic bottom; CSS handles positioning

  constructor() {}

  /** Get the lit color for the moon */
  public getMoonLitColor(): string {
    return '#d4d4d4';
  }

  /** Get the background color for the moon's shadow */
  public getMoonBackgroundColor(): string {
    return '#000000';
  }
}
