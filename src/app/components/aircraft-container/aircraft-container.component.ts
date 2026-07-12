import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WindowViewPlane } from '../../types/window-view-plane';
import { AircraftContainerFacadeService } from '../../services/window-view/aircraft-container-facade.service';
import { AircraftPlaneItemComponent } from './aircraft-plane-item/aircraft-plane-item.component';

@Component({
  selector: 'app-aircraft-container',
  standalone: true,
  imports: [CommonModule, AircraftPlaneItemComponent],
  templateUrl: './aircraft-container.component.html',
  styleUrl: './aircraft-container.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AircraftContainerComponent implements OnChanges {
  @Input() aircraftPlanes: WindowViewPlane[] = [];
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() showAltitudeBorders = false;
  @Input() skyBottomColor = 'rgb(135, 206, 235)';
  @Input() skyTopColor = 'rgb(25, 25, 112)';
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();

  constructor(public facade: AircraftContainerFacadeService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showAltitudeBorders'] || changes['aircraftPlanes']) {
      this.facade.clearCaches();
    }
  }

  trackByPlaneIcao = (index: number, plane: WindowViewPlane) =>
    this.facade.trackByPlaneIcao(index, plane);

  onSelectPlane(plane: WindowViewPlane): void {
    this.selectPlane.emit(plane);
  }
}
