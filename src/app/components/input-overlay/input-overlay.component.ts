import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrightnessState } from '../../services/brightness.service';
import { InputOverlayFacadeService } from '../../services/input-overlay/input-overlay-facade.service';
import { InputOverlayTogglesComponent } from './input-overlay-toggles/input-overlay-toggles.component';
import { InputOverlayFormComponent } from './input-overlay-form/input-overlay-form.component';
import { InputComponent } from '../ui/input/input.component';

@Component({
  selector: 'app-input-overlay',
  standalone: true,
  imports: [CommonModule, InputOverlayTogglesComponent, InputOverlayFormComponent],
  templateUrl: './input-overlay.component.html',
  styleUrls: ['./input-overlay.component.scss'],
})
export class InputOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() showAirportLabels = true;
  @Output() toggleAirportLabels = new EventEmitter<boolean>();
  @ViewChild(InputOverlayFormComponent) form?: InputOverlayFormComponent;
  @Output() resolveAndUpdate = new EventEmitter<void>();
  @Output() useCurrentLocation = new EventEmitter<void>();
  @Output() coneVisibilityChange = new EventEmitter<boolean>();
  @Output() coneConfigChange = new EventEmitter<void>();
  @Output() setHome = new EventEmitter<void>();
  @Output() goToHome = new EventEmitter<void>();
  @Input() showCloudCover = true;
  @Output() cloudToggleChange = new EventEmitter<boolean>();
  @Input() showRainCover = true;
  @Output() rainToggleChange = new EventEmitter<boolean>();
  @Input() showDateTime = true;
  @Output() toggleDateTimeOverlays = new EventEmitter<void>();
  @Input() brightness = 1;
  @Input() brightnessState: BrightnessState | null = null;
  @Output() brightnessToggle = new EventEmitter<void>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() distanceUnitChanged = new EventEmitter<string>();
  @Input() showViewAxes = false;
  @Input() showAltitudeBorders = false;
  @Output() altitudeBordersChange = new EventEmitter<boolean>();
  @Input() animationsEnabled = true;
  @Output() animationsEnabledChange = new EventEmitter<boolean>();

  constructor(
    public facade: InputOverlayFacadeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.facade.init(this.cdr);
  }

  ngAfterViewInit(): void {
    this.facade.init(this.cdr, () => this.form?.addressInputRef);
  }

  ngOnDestroy(): void {
    this.facade.destroy();
  }

  get collapsed(): boolean {
    return this.facade.collapsed;
  }

  refreshDisplayValues(): void {
    this.cdr.detectChanges();
  }

  clearAddressField(): void {
    this.facade.clearAddress(this.cdr);
    this.form?.addressInputRef?.setValue('');
  }

  onResolveAndUpdate(): void {
    this.resolveAndUpdate.emit();
  }
}
