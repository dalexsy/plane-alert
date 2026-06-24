import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ViewEncapsulation,
  HostListener,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ConeComponent } from '../components/cone/cone.component';
import { ConeConfigEditorComponent } from '../components/cone-config-editor/cone-config-editor.component';
import { InputOverlayComponent } from '../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../components/results-overlay/results-overlay.component';
import { ClockComponent } from '../components/ui/clock/clock.component';
import { TemperatureComponent } from '../components/ui/temperature/temperature.component';
import { ClosestPlaneOverlayComponent } from '../components/closest-plane-overlay/closest-plane-overlay.component';
import { LocationOverlayComponent } from '../components/location-overlay/location-overlay.component';
import { WindowViewOverlayComponent } from '../components/window-view-overlay/window-view-overlay.component';
import { AngleOverlayComponent } from '../components/angle-overlay/angle-overlay.component';
import { CountryService } from '../services/country.service';
import { AirportService } from '../services/airport.service';
import { UiStateService } from '../services/ui-state.service';
import { AstronomicalDisplayService } from '../services/astronomical-display.service';
import { BrightnessDisplayService } from '../services/brightness-display.service';
import { MapRuntimeService } from '../services/map/map-runtime.service';
import { MapOverlayStateService } from '../services/map/map-overlay-state.service';
import { MapBootstrapService } from '../services/map/map-bootstrap.service';
import { MapBootstrapSubscriptionsService } from '../services/map/map-bootstrap-subscriptions.service';
import { MapEventRegistrationService } from '../services/map/map-event-registration.service';
import { MapComponentFacadeService } from '../services/map/map-component-facade.service';
import type { WindowViewPlane } from '../components/window-view-overlay/window-view-overlay.component';
import type { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';
import type { ViewConeConfig } from '../services/settings.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    ConeComponent,
    ConeConfigEditorComponent,
    InputOverlayComponent,
    ResultsOverlayComponent,
    ClockComponent,
    TemperatureComponent,
    ClosestPlaneOverlayComponent,
    LocationOverlayComponent,
    WindowViewOverlayComponent,
    AngleOverlayComponent,
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class.map-panning') panning = false;

  @ViewChild(InputOverlayComponent, { static: true })
  inputOverlayComponent!: InputOverlayComponent;
  @ViewChild(ResultsOverlayComponent, { static: true })
  resultsOverlayComponent!: ResultsOverlayComponent;
  @ViewChild(WindowViewOverlayComponent, { static: true })
  windowViewOverlayComponent!: WindowViewOverlayComponent;

  constructor(
    public countryService: CountryService,
    public runtime: MapRuntimeService,
    public overlay: MapOverlayStateService,
    public uiState: UiStateService,
    public astronomicalDisplay: AstronomicalDisplayService,
    public brightnessDisplay: BrightnessDisplayService,
    public airportService: AirportService,
    public facade: MapComponentFacadeService,
    public cdr: ChangeDetectorRef,
    private bootstrap: MapBootstrapService,
    private bootstrapSubs: MapBootstrapSubscriptionsService,
    private eventRegistration: MapEventRegistrationService
  ) {
    this.runtime.globalTooltipClickHandler = () => undefined;
    this.eventRegistration.registerOnConstruct(this.hostRefs);
  }

  private get hostRefs() {
    return {
      inputOverlayComponent: this.inputOverlayComponent,
      resultsOverlayComponent: this.resultsOverlayComponent,
      windowViewOverlayComponent: this.windowViewOverlayComponent,
      cdr: this.cdr,
    };
  }

  get map(): L.Map {
    return this.runtime.map;
  }

  get viewConesConfig(): ViewConeConfig[] {
    return this.runtime.viewConesConfig;
  }

  get showConeConfigEditor(): boolean {
    return this.runtime.showConeConfigEditor;
  }

  get loadingAirports(): boolean {
    return this.airportService.isLoading();
  }

  async ngAfterViewInit(): Promise<void> {
    await this.bootstrap.bootstrap(this.hostRefs);
  }

  ngOnDestroy(): void {
    this.bootstrapSubs.destroy();
    this.bootstrap.teardown();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.facade.onWindowResize(this.cdr);
  }

  followNearestPlane(plane: PlaneLogEntry | WindowViewPlane): void {
    this.facade.followNearestPlane(plane as PlaneLogEntry, this.cdr);
  }
}
