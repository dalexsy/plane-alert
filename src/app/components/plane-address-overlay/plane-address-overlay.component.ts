import {
  Component,
  Input,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaneModel } from '../../models/plane-model';

@Component({
  selector: 'app-plane-address-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plane-address-overlay.component.html',
  styleUrls: ['./plane-address-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaneAddressOverlayComponent {
  /** Human-readable address for the followed/nearest plane */
  @Input() address: string | null = null;
  @Input() plane: PlaneModel | null = null;
  @Input() isSelected: boolean = false;
  @HostBinding('class.selected') get selected() {
    return this.isSelected;
  }
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.plane?.isMilitary === true;
  }

  @Output() selectPlane = new EventEmitter<PlaneModel>();

  /** Handle click to center on plane */
  onClick(): void {
    if (this.plane) {
      this.selectPlane.emit(this.plane);
    }
  }
}
