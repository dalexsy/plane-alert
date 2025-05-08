import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../ui/icon.component';
import { PlaneModel } from '../../models/plane-model';

@Component({
  selector: 'app-closest-plane-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './closest-plane-overlay.component.html',
  styleUrls: ['./closest-plane-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosestPlaneOverlayComponent {
  @Input() plane: PlaneModel | null = null;
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.isSelected && this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.isSelected && this.plane?.isSpecial === true;
  }
  @Input() distanceKm: number | null = null;
  @Input() operator: string | null = null;
  @Input() secondsAway: number | null = null;
  @Input() velocity: number | null = null;
  @Input() isSelected: boolean = false;
  @Output() selectPlane = new EventEmitter<PlaneModel>();

  /** Formatted ETA in #m #s format without suffix */
  get formattedEta(): string {
    if (this.secondsAway == null) {
      return '';
    }
    const m = Math.floor(this.secondsAway / 60);
    const s = this.secondsAway % 60;
    return `${m}m ${s}s`;
  }

  /** Handle user click to select this plane */
  onClick(): void {
    if (this.plane) {
      this.selectPlane.emit(this.plane);
    }
  }
}
