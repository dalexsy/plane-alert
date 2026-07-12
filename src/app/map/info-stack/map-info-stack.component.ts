import { Component, Input, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngleOverlayComponent } from '../../components/angle-overlay/angle-overlay.component';
import { ClockComponent } from '../../components/ui/clock/clock.component';
import { TemperatureComponent } from '../../components/ui/temperature/temperature.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapOverlayStateService } from '../../services/map/map-overlay-state.service';
import { MapComponentFacadeService } from '../../services/map/map-component-facade.service';
import { UiStateService } from '../../services/ui-state/ui-state.service';
import { AstronomicalDisplayService } from '../../services/astronomical-display/astronomical-display.service';
import type { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import type { WindowViewPlane } from '../../components/window-view-overlay/window-view-overlay.component';

/** Angle readout, clock/temperature strip, and window-view band. */
@Component({
  selector: 'app-map-info-stack',
  standalone: true,
  imports: [
    CommonModule,
    AngleOverlayComponent,
    ClockComponent,
    TemperatureComponent,
    WindowViewOverlayComponent,
  ],
  templateUrl: './map-info-stack.component.html',
  styleUrls: ['./map-info-stack.component.scss'],
})
export class MapInfoStackComponent {
  @ViewChild(WindowViewOverlayComponent) windowViewOverlayComponent?: WindowViewOverlayComponent;
  @Input() resultsCollapsed = true;
  @Input() inputControlsHidden = false;

  constructor(
    public overlay: MapOverlayStateService,
    public uiState: UiStateService,
    public astronomicalDisplay: AstronomicalDisplayService,
    public facade: MapComponentFacadeService,
    public cdr: ChangeDetectorRef
  ) {}

  followNearestPlane(plane: PlaneLogEntry | WindowViewPlane): void {
    this.facade.followNearestPlane(plane as PlaneLogEntry, this.cdr);
  }
}
