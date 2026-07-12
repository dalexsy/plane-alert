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
import { CountryService } from '../services/country/country.service';
import { AirportService } from '../services/airport/airport.service';
import { UiStateService } from '../services/ui-state/ui-state.service';
import { MapRuntimeService } from '../services/map/map-runtime.service';
import { MapOverlayStateService } from '../services/map/map-overlay-state.service';
import { MapBootstrapService } from '../services/map/map-bootstrap.service';
import { MapBootstrapSubscriptionsService } from '../services/map/map-bootstrap-subscriptions.service';
import { MapEventRegistrationService } from '../services/map/map-event-registration.service';
import { MapComponentFacadeService } from '../services/map/map-component-facade.service';
import { MapContainerComponent } from './container/map-container.component';
import { MapOverlaysComponent } from './overlays/map-overlays.component';
import { MapInfoStackComponent } from './info-stack/map-info-stack.component';
import type { ViewConeConfig } from '../services/settings/settings.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, MapContainerComponent, MapOverlaysComponent, MapInfoStackComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class.map-panning') panning = false;

  @ViewChild(MapOverlaysComponent, { static: true })
  overlaysComponent!: MapOverlaysComponent;
  @ViewChild(MapInfoStackComponent, { static: true })
  infoStackComponent!: MapInfoStackComponent;

  constructor(
    public countryService: CountryService,
    public runtime: MapRuntimeService,
    public overlay: MapOverlayStateService,
    public uiState: UiStateService,
    public airportService: AirportService,
    public facade: MapComponentFacadeService,
    public cdr: ChangeDetectorRef,
    private bootstrap: MapBootstrapService,
    private bootstrapSubs: MapBootstrapSubscriptionsService,
    private eventRegistration: MapEventRegistrationService
  ) {
    this.runtime.globalTooltipClickHandler = () => undefined;
    this.eventRegistration.registerOnConstruct(this.cdr);
  }

  private get hostRefs() {
    return {
      inputOverlayComponent: this.overlaysComponent.inputOverlayComponent,
      resultsOverlayComponent: this.overlaysComponent.resultsOverlayComponent,
      windowViewOverlayComponent: this.infoStackComponent.windowViewOverlayComponent,
      cdr: this.cdr,
    };
  }

  get map() {
    return this.runtime.map;
  }

  get viewConesConfig(): ViewConeConfig[] {
    return this.runtime.viewConesConfig;
  }

  get showConeConfigEditor(): boolean {
    return this.runtime.showConeConfigEditor;
  }

  get resultsCollapsed(): boolean {
    return this.overlaysComponent?.resultsOverlayComponent?.collapsed ?? true;
  }

  get inputControlsHidden(): boolean {
    return this.overlaysComponent?.inputOverlayComponent?.facade.otherControlsHidden ?? false;
  }

  async ngAfterViewInit(): Promise<void> {
    await this.bootstrap.bootstrap({
      inputOverlayComponent: this.overlaysComponent.inputOverlayComponent,
      resultsOverlayComponent: this.overlaysComponent.resultsOverlayComponent,
      windowViewOverlayComponent: this.infoStackComponent.windowViewOverlayComponent,
      cdr: this.cdr,
    });
  }

  ngOnDestroy(): void {
    this.bootstrapSubs.destroy();
    this.bootstrap.teardown();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.facade.onWindowResize(this.cdr);
  }
}
