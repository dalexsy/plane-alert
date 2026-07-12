import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../ui/button/button.component';
import { InputComponent } from '../ui/input/input.component';
import { SettingsService } from '../../services/settings/settings.service';
import { InputOverlayFacadeService } from '../../services/input-overlay/input-overlay-facade.service';
import {
  getDistanceUnitLabel,
  DistanceUnit,
  convertFromKm,
  formatDistance,
} from '../../utils/units/units.util';

@Component({
  selector: 'app-input-overlay-form',
  standalone: true,
  imports: [CommonModule, ButtonComponent, InputComponent],
  templateUrl: './input-overlay-form.component.html',
  styleUrls: ['./input-overlay-form.component.scss'],
})
export class InputOverlayFormComponent {
  @Input({ required: true }) facade!: InputOverlayFacadeService;
  @Output() resolveAndUpdate = new EventEmitter<void>();
  @Output() useCurrentLocation = new EventEmitter<void>();
  @Output() setHome = new EventEmitter<void>();
  @Output() goToHome = new EventEmitter<void>();
  @Output() distanceUnitChanged = new EventEmitter<string>();

  @ViewChild('addressInput') addressInputRef!: InputComponent;
  @ViewChild('searchRadiusInput') searchRadiusInputRef!: ElementRef<HTMLInputElement>;

  currentSliderRadiusKm = 5;

  constructor(
    public settings: SettingsService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentSliderRadiusKm = this.getRadiusInKm();
  }

  get displaySliderRadius(): string {
    const converted = convertFromKm(
      this.currentSliderRadiusKm,
      this.settings.distanceUnit as DistanceUnit
    );
    return formatDistance(Math.round(converted * 10) / 10);
  }

  getDistanceUnitLabel(): string {
    return getDistanceUnitLabel(this.settings.distanceUnit as DistanceUnit);
  }

  getRadiusInKm(): number {
    return Math.round(this.settings.radius ?? 5);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.facade.isUserEditingAddress = false;
    this.resolveAndUpdate.emit();
  }

  onRadiusSlide(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentSliderRadiusKm = parseInt(input.value, 10);
    this.cdr.detectChanges();
  }

  onRadiusChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const radiusKm = parseInt(input.value, 10);
    this.currentSliderRadiusKm = radiusKm;
    this.settings.setRadius(radiusKm);
    this.resolveAndUpdate.emit();
  }

  onAddressFocus(): void {
    this.facade.isUserEditingAddress = true;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    if (isMobile && this.addressInputRef) {
      setTimeout(() => this.addressInputRef.select(), 0);
    }
  }

  onAddressChange(value: string): void {
    this.facade.currentAddress = value;
    this.facade.isUserEditingAddress = true;
  }

  onAddressBlur(): void {
    this.facade.isUserEditingAddress = false;
  }

  processRadiusChange(): void {
    const el = this.searchRadiusInputRef?.nativeElement;
    if (!el) return;
    const radiusKm = parseInt(el.value, 10);
    if (!isNaN(radiusKm) && radiusKm > 0) {
      this.currentSliderRadiusKm = radiusKm;
      this.settings.setRadius(radiusKm);
    }
  }
}