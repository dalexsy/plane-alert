import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapRuntimeService } from '../../services/map/map-runtime.service';
import { ConeComponent } from '../../components/cone/cone.component';
import { ConeConfigEditorComponent } from '../../components/cone-config-editor/cone-config-editor.component';
import { UiStateService } from '../../services/ui-state/ui-state.service';
import { MapComponentFacadeService } from '../../services/map/map-component-facade.service';
import type { ViewConeConfig } from '../../services/settings/settings.service';
/** Leaflet mount point, airport SVG defs, and view-cone layers. */
@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, ConeComponent, ConeConfigEditorComponent],
  templateUrl: './map-container.component.html',
  styleUrls: ['./map-container.component.scss'],
})
export class MapContainerComponent {
  @Input({ required: true }) viewConesConfig!: ViewConeConfig[];
  @Input({ required: true }) showConeConfigEditor!: boolean;

  constructor(
    public runtime: MapRuntimeService,
    public uiState: UiStateService,
    public facade: MapComponentFacadeService,
    public cdr: ChangeDetectorRef
  ) {}

  get map() {
    return this.runtime.map;
  }

  onConeConfigChange(cones: ViewConeConfig[]): void {
    this.facade.onConeConfigChange(cones, this.cdr);
  }
}
