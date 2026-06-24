import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputComponent } from '../../ui/input/input.component';
import { SettingsService } from '../../../services/settings.service';
import { ScanService } from '../../../services/scan.service';
import { InputOverlayFacadeService } from '../../../services/input-overlay/input-overlay-facade.service';
import {
  getDistanceUnitLabel,
  DistanceUnit,
} from '../../../utils/units.util';
import {
  handleRadiusKeydown,
  normalizeRadiusInputValue,
} from '../../../services/input-overlay/input-overlay-form.util';

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
  @ViewChild('checkIntervalInput') checkIntervalInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    public settings: SettingsService,
    private scanService: ScanService
  ) {}

  getDistanceUnitLabel(): string {
    return getDistanceUnitLabel(this.settings.distanceUnit as DistanceUnit);
  }

  getTimeUnitLabel(): string {
    return this.settings.timeUnit === 'seconds' ? 'sec' : 'min';
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.processRadius();
    this.facade.isUserEditingAddress = false;
    this.facade.markScanTime();
    this.resolveAndUpdate.emit();
  }

  onRadiusFocus(): void {
    this.facade.isUserEditingRadius = true;
  }

  onRadiusBlur(): void {
    this.facade.isUserEditingRadius = false;
    this.processRadius();
  }

  onRadiusInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeRadiusInputValue(input.value);
    if (input.value !== normalized) {
      const pos = input.selectionStart;
      input.value = normalized;
      if (pos != null) input.setSelectionRange(pos, pos);
    }
  }

  onRadiusKeydown(event: KeyboardEvent): void {
    handleRadiusKeydown(event);
  }

  onIntervalChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (isNaN(value)) return;
    this.settings.setIntervalFromDisplayUnit(value);
    this.scanService.updateInterval(this.settings.interval);
  }

  toggleTimeUnit(): void {
    this.settings.setTimeUnit(
      this.settings.timeUnit === 'seconds' ? 'minutes' : 'seconds'
    );
  }

  toggleDistanceUnit(): void {
    const newUnit = this.settings.distanceUnit === 'km' ? 'miles' : 'km';
    this.settings.setDistanceUnit(newUnit);
    this.distanceUnitChanged.emit(newUnit);
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

  private processRadius(): void {
    const el = this.searchRadiusInputRef?.nativeElement;
    if (!el) return;
    this.facade.processRadiusFromInput(el.value);
  }
}
