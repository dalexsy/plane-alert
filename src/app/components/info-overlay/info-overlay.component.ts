import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngleOverlayComponent } from '../angle-overlay/angle-overlay.component';
import { ClockComponent } from '../ui/clock/clock.component';
import { TemperatureComponent } from '../ui/temperature/temperature.component';
import { WindowViewOverlayComponent } from '../window-view-overlay/window-view-overlay.component';

@Component({
  selector: 'app-info-overlay',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    AngleOverlayComponent,
    ClockComponent,
    TemperatureComponent,
    WindowViewOverlayComponent,
  ],
  templateUrl: './info-overlay.component.html',
  styleUrls: ['./info-overlay.component.scss'],
})
export class InfoOverlayComponent {
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
  @Input() showWindowView!: boolean;
  @Input() showDateTime!: boolean;
  @Input() collapsed!: boolean;
  @Input() windowViewPlanes!: any[];
  @Input() highlightedPlaneIcao!: string | null;
  @Input() observerLat!: number;
  @Input() observerLon!: number;
  @Input() isAtHome!: boolean;
  @Input() showAltitudeBorders!: boolean;
  @Input() animationsEnabled!: boolean;

  @Output() cycleWindUnit = new EventEmitter<void>();
  @Output() selectPlane = new EventEmitter<any>();

  onCycleWind() {
    this.cycleWindUnit.emit();
  }
  followNearestPlane(plane: any) {
    this.selectPlane.emit(plane);
  }
}
