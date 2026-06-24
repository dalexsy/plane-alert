import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WindowViewPlane } from '../../../../types/window-view-plane';
import { FlagCallsignComponent } from '../../../flag-callsign/flag-callsign.component';
import { PlaneStyleService } from '../../../../services/plane-style.service';
import { AircraftContainerFacadeService } from '../../../../services/window-view/aircraft-container-facade.service';

@Component({
  selector: 'app-aircraft-labels',
  standalone: true,
  imports: [CommonModule, FlagCallsignComponent],
  templateUrl: './aircraft-labels.component.html',
  styleUrls: ['./aircraft-labels.component.scss'],
})
export class AircraftLabelsComponent {
  @Input({ required: true }) plane!: WindowViewPlane;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() showAltitudeBorders = false;
  @Output() labelClick = new EventEmitter<MouseEvent>();

  constructor(
    public facade: AircraftContainerFacadeService,
    public planeStyle: PlaneStyleService
  ) {}

  get labelClasses(): string {
    return this.facade.getLabelClasses(
      this.plane,
      this.highlightedPlaneIcao,
      this.showAltitudeBorders
    );
  }

  get borderStyle(): Record<string, string> {
    return this.facade.getAltitudeBorderStyle(
      this.plane,
      this.showAltitudeBorders
    );
  }

  get showDetails(): boolean {
    return (
      this.plane.distanceKm != null &&
      this.plane.distanceKm <= 10 &&
      !this.plane.isGrounded &&
      !!(this.plane.operator || this.plane.model)
    );
  }
}
