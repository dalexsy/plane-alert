import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WindowViewPlane } from '../../../types/window-view-plane';
import { AltitudeColorService } from '../../../services/altitude-color/altitude-color.service';
import { AircraftContainerFacadeService } from '../../../services/window-view/aircraft-container-facade.service';
import {
  get3DDepthTransform,
  getAtmosphericPerspective,
  getChemtrailRotation,
  getChemtrailScale,
  getIconRotation,
  getPerspectiveTransform,
  planeBottomStyle,
  planeScalePrefix,
} from '../../../services/window-view/aircraft-transform.util';
import { AircraftTrailComponent } from '../aircraft-trail/aircraft-trail.component';
import { AircraftLabelsComponent } from '../aircraft-labels/aircraft-labels.component';

@Component({
  selector: 'app-aircraft-plane-item',
  standalone: true,
  imports: [
    CommonModule,
    AircraftTrailComponent,
    AircraftLabelsComponent,
  ],
  templateUrl: './aircraft-plane-item.component.html',
  styleUrls: ['./aircraft-plane-item.component.scss'],
})
export class AircraftPlaneItemComponent {
  @Input({ required: true }) plane!: WindowViewPlane;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() showAltitudeBorders = false;
  @Input() animationsEnabled = true;
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();

  constructor(
    public altitudeColor: AltitudeColorService,
    public facade: AircraftContainerFacadeService
  ) {}

  getPerspectiveTransform = getPerspectiveTransform;
  getIconRotation = getIconRotation;
  getChemtrailScale = getChemtrailScale;
  getChemtrailRotation = getChemtrailRotation;
  planeBottomStyle = planeBottomStyle;
  planeScalePrefix = planeScalePrefix;
  get3DDepthTransform = get3DDepthTransform;
  getAtmosphericPerspective = getAtmosphericPerspective;

  get showTrail(): boolean {
    return (
      !this.plane.isGrounded &&
      !this.plane.isHelicopter &&
      !this.plane.isMarker &&
      !this.plane.isCelestial &&
      getChemtrailScale(this.plane) > 0
    );
  }

  get isMidMarker(): boolean {
    return (
      !!this.plane.isMarker &&
      !(this.plane.callsign.endsWith('Start') || this.plane.callsign.endsWith('End'))
    );
  }

  onIconClick(event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(this.plane);
  }

  onLabelClick(event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(this.plane);
  }

  onMouseEnter(event: MouseEvent): void {
    this.facade.onMouseEnter(this.plane, event);
  }

  onMouseLeave(): void {
    this.facade.hideOperatorTooltip();
  }
}
