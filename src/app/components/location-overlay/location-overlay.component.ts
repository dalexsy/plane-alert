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
  @Input()
  set plane(value: PlaneModel | null) {
    this._plane = value;

    // Check if we had an empty district before the plane was set
    if (value && this._hasEmptyDistrict) {
      console.log(
        `[LOCATION-OVERLAY] Plane set after empty district detected for ${value.icao} (${value.callsign})`,
        {
          district: this._district,
          plane: { icao: value.icao, callsign: value.callsign },
          timestamp: new Date().toISOString(),
        }
      );
      this._hasEmptyDistrict = false; // Reset the flag
    }
  }
  get plane(): PlaneModel | null {
    return this._plane;
  }
  private _plane: PlaneModel | null = null;
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.isSelected && this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.isSelected && this.plane?.isSpecial === true;
  }
  @Input() street: string | null = null;

  @Input()
  set district(value: string | null) {
    const isEmpty = !value || value.trim() === '';

    // Enhanced logging: capture all empty district scenarios
    if (isEmpty) {
      if (this.plane) {
        console.log(
          `[LOCATION-OVERLAY] District empty for ${this.plane.icao} (${this.plane.callsign})`,
          {
            district: value,
            plane: { icao: this.plane.icao, callsign: this.plane.callsign },
            timestamp: new Date().toISOString(),
          }
        );
      } else {
        console.log(`[LOCATION-OVERLAY] District empty but no plane yet`, {
          district: value,
          timestamp: new Date().toISOString(),
        });
        // Store the empty state to check later when plane is set
        this._hasEmptyDistrict = true;
      }
    } else {
      // Reset the empty flag when we get a valid district
      this._hasEmptyDistrict = false;
    }

    this._district = value;
  }
  get district(): string | null {
    return this._district;
  }
  private _district: string | null = null;
  private _hasEmptyDistrict: boolean = false;

  @Input() isSelected: boolean = false;
  @Output() selectPlane = new EventEmitter<PlaneModel>();

  constructor(private debouncedClick: DebouncedClickService) {}
  /** Handle user click to select this plane */
  onClick(): void {
    if (this.plane) {
      this.debouncedClick.debouncedClick(
        `location-overlay-${this.plane.icao}`,
        () => {
          this.selectPlane.emit(this.plane!);
        }
      );
    }
  }
}
