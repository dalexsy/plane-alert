import {
  Component,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { ClosestPlaneOverlayComponent } from '../../components/closest-plane-overlay/closest-plane-overlay.component';
import { LocationOverlayComponent } from '../../components/location-overlay/location-overlay.component';
import { MapOverlayStateService } from '../../services/map/map-overlay-state.service';
import { MapComponentFacadeService } from '../../services/map/map-component-facade.service';
import { UiStateService } from '../../services/ui-state/ui-state.service';
import { BrightnessDisplayService } from '../../services/brightness-display/brightness-display.service';
import { AirportService } from '../../services/airport/airport.service';
import type { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';

/** Top overlays: closest plane, location, input bar, results sidebar. */
@Component({
  selector: 'app-map-overlays',
  standalone: true,
  imports: [
    CommonModule,
    InputOverlayComponent,
    ResultsOverlayComponent,
    ClosestPlaneOverlayComponent,
    LocationOverlayComponent,
  ],
  templateUrl: './map-overlays.component.html',
  styleUrls: ['./map-overlays.component.scss'],
})
export class MapOverlaysComponent {
  @ViewChild(InputOverlayComponent, { static: true })
  inputOverlayComponent!: InputOverlayComponent;
  @ViewChild(ResultsOverlayComponent, { static: true })
  resultsOverlayComponent!: ResultsOverlayComponent;

  constructor(
    public overlay: MapOverlayStateService,
    public facade: MapComponentFacadeService,
    public uiState: UiStateService,
    public brightnessDisplay: BrightnessDisplayService,
    public airportService: AirportService,
    public cdr: ChangeDetectorRef
  ) {}

  get loadingAirports(): boolean {
    return this.airportService.isLoading();
  }

  followNearestPlane(plane: PlaneLogEntry): void {
    this.facade.followNearestPlane(plane, this.cdr);
  }
}
