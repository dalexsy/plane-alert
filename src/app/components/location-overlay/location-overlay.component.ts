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
import { DebouncedClickService } from '../../services/debounced-click.service';

@Component({
  selector: 'app-location-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './location-overlay.component.html',
  styleUrls: ['./location-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationOverlayComponent {
  @Input() plane: PlaneModel | null = null;
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.isSelected && this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.isSelected && this.plane?.isSpecial === true;
  }
  @Input() street: string | null = null;
  @Input() district: string | null = null;
  @Input() isSelected: boolean = false;
  @Output() selectPlane = new EventEmitter<PlaneModel>();

  constructor(private debouncedClick: DebouncedClickService) {}
  /** Handle user click to select this plane */
  onClick(): void {
    if (this.plane) {
      this.debouncedClick.debouncedClick(`location-overlay-${this.plane.icao}`, () => {
        this.selectPlane.emit(this.plane!);
      });
    }
  }
}
