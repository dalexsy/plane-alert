/* src/app/components/input-overlay/input-overlay.component.ts */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  OnDestroy,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { ScanService } from '../../services/scan.service';
import { BrightnessState } from '../../services/brightness.service';
import { Subscription, combineLatest } from 'rxjs';
import { ButtonComponent } from '../ui/button.component';
import { TabComponent } from '../ui/tab.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { DistanceUnit, getDistanceUnitLabel, convertFromKm, convertToKm } from '../../utils/units.util';

@Component({
  selector: 'app-input-overlay',
  standalone: true,
  imports: [CommonModule, ButtonComponent, TabComponent, TooltipDirective],
  templateUrl: './input-overlay.component.html',
  styleUrls: ['./input-overlay.component.scss'],
})
export class InputOverlayComponent implements OnDestroy {
  @Input() showAirportLabels: boolean = true;
  @Output() toggleAirportLabels = new EventEmitter<boolean>();
  @ViewChild('addressInput', { static: false })
  addressInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('searchRadiusInput', { static: false })
  searchRadiusInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('checkIntervalInput', { static: false })
  checkIntervalInputRef!: ElementRef<HTMLInputElement>;
  @Output() resolveAndUpdate = new EventEmitter<void>();
  @Output() useCurrentLocation = new EventEmitter<void>();
  @Output() coneVisibilityChange = new EventEmitter<boolean>();
  @Output() setHome = new EventEmitter<void>();
  @Output() goToHome = new EventEmitter<void>();
  @Input() showCloudCover = true;
  @Output() cloudToggleChange = new EventEmitter<boolean>();
  @Input() showRainCover = true;
  @Output() rainToggleChange = new EventEmitter<boolean>();
  @Input() showDateTime = true;
  @Output() toggleDateTimeOverlays = new EventEmitter<void>();
  @Input() brightness: number = 1;
  @Input() brightnessState: BrightnessState | null = null;
  @Output() brightnessToggle = new EventEmitter<void>();
  /** Emit when zoom in button is clicked */
  @Output() zoomIn = new EventEmitter<void>();
  /** Emit when zoom out button is clicked */
  @Output() zoomOut =
    new EventEmitter<void>(); /** Whether to show view axes (cones) */
  @Input() showViewAxes = false;
  /** Whether to show altitude-colored tooltip borders */
  @Input() showAltitudeBorders = false;
  @Output() altitudeBordersChange = new EventEmitter<boolean>();  scanButtonText = '';
  private sub!: Subscription;
  private isUserEditingRadius = false;
  @HostBinding('class.collapsed')
  collapsed: boolean = localStorage.getItem('inputOverlayCollapsed') === 'true';
  public currentAddress: string = '';
  public showBrightnessTooltip = false;

  constructor(
    public settings: SettingsService,
    private cdr: ChangeDetectorRef,
    private scanService: ScanService
  ) {}

  /** Emit when brightness toggle button is clicked */
  onBrightnessToggle(): void {
    this.brightnessToggle.emit();
  }
  /** Emit when zoom in button is clicked */
  onZoomIn(): void {
    this.zoomIn.emit();
  }

  /** Emit when zoom out button is clicked */
  onZoomOut(): void {
    this.zoomOut.emit();
  }

  ngAfterViewInit(): void {
    this.sub = combineLatest([
      this.scanService.countdown$,
      this.scanService.isActive$,
    ]).subscribe(([count, active]) => {
      this.scanButtonText = active
        ? `Update now (next update in ${count}s)`
        : `Start scanning at location`;
      this.cdr.detectChanges();    });    // Only set input values if not collapsed and refs exist
    if (!this.collapsed) {
      if (this.searchRadiusInputRef?.nativeElement) {
        const displayRadius = this.getDisplayRadius();
        this.searchRadiusInputRef.nativeElement.value = displayRadius.toString();
      }
      if (this.checkIntervalInputRef?.nativeElement) {
        const displayedInterval = this.settings.interval.toString();
        this.checkIntervalInputRef.nativeElement.value = displayedInterval;
      }
    }
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('inputOverlayCollapsed', this.collapsed.toString());
    this.cdr.detectChanges();
  }  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }  onResolveAndUpdate(event?: Event): void {
    // Prevent the browser from reloading the page on form submit
    event?.preventDefault();
    
    // Make sure to save the current radius value in the correct unit before proceeding
    this.processRadiusChange();
    
    // Update now button pressed would be logged here
    this.resolveAndUpdate.emit();
  }onUseCurrentLocation(): void {
    this.useCurrentLocation.emit();
  }  processRadiusChange(): void {
    if (!this.searchRadiusInputRef?.nativeElement) {
      return;
    }
    
    const val = this.searchRadiusInputRef.nativeElement.valueAsNumber;
    const currentUnit = this.settings.distanceUnit;
    
    if (!isNaN(val) && val > 0) {
      // Convert displayed value to kilometers for storage
      const unit = currentUnit as DistanceUnit;
      const radiusInKm = convertToKm(val, unit);
      this.settings.setRadius(radiusInKm);
    }
  }
  onRadiusFocus(): void {
    this.isUserEditingRadius = true;
  }  onRadiusBlur(): void {
    this.isUserEditingRadius = false;
    this.processRadiusChange();
  }

  onIntervalChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const seconds = input.valueAsNumber;
    if (isNaN(seconds)) {
      return;
    }
    const newInterval = seconds;
    this.settings.interval = newInterval;
    this.scanService.updateInterval(newInterval);
  }

  onSetHome(): void {
    this.setHome.emit();
  }

  onGoToHome(): void {
    this.goToHome.emit();
  }

  onShowCloudCoverChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.cloudToggleChange.emit(checked);
  }

  onShowRainCoverChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rainToggleChange.emit(checked);
  }

  onToggleAirportLabels(): void {
    // Toggle the internal flag and emit new state
    this.showAirportLabels = !this.showAirportLabels;
    this.toggleAirportLabels.emit(this.showAirportLabels);
  }
  /** Get brightness button icon based on current state */
  get brightnessIcon(): string {
    if (!this.brightnessState) return 'brightness_empty';

    if (this.brightnessState.mode === 'auto') {
      // Automatic mode - show icon based on sun elevation
      if (this.brightnessState.sunElevation > 0) {
        return 'brightness_5'; // Daytime
      } else if (this.brightnessState.sunElevation > -6) {
        return 'brightness_6'; // Civil twilight
      } else if (this.brightnessState.sunElevation > -12) {
        return 'brightness_7'; // Nautical twilight
      } else {
        return 'brightness_4'; // Night/astronomical twilight
      }
    } else {
      // Manual mode - show brightness level
      return this.brightnessState.brightness > 0.7
        ? 'brightness_auto'
        : 'brightness_auto';
    }
  }
  /** Get brightness button tooltip based on current state */
  get brightnessTooltip(): string {
    if (!this.brightnessState) return 'Toggle map brightness';

    if (this.brightnessState.mode === 'auto') {
      const sunStatus =
        this.brightnessState.sunElevation > 0
          ? 'day'
          : this.brightnessState.sunElevation > -6
          ? 'civil twilight'
          : this.brightnessState.sunElevation > -12
          ? 'nautical twilight'
          : 'night';
      return `Auto brightness (${sunStatus}, ${Math.round(
        this.brightnessState.brightness * 100
      )}%) - Disable auto-dimming`;
    } else {
      const level = this.brightnessState.brightness > 0.7 ? 'bright' : 'dim';
      return `Manual brightness (${level}, ${Math.round(
        this.brightnessState.brightness * 100
      )}%) - Enable auto-dimming`;
    }
  }

  /** Get simple brightness button tooltip for title attribute */
  get brightnessSimpleTooltip(): string {
    if (!this.brightnessState) return 'Toggle map brightness';

    return this.brightnessState.mode === 'auto'
      ? 'Disable auto-dimming'
      : 'Enable auto-dimming';
  } /** Get the full tooltip text with enable/disable and sun status */
  get sunStatusTooltip(): string {
    if (!this.brightnessState) return 'Toggle map brightness';

    const enableDisableText =
      this.brightnessState.mode === 'auto'
        ? 'Disable auto-dimming'
        : 'Enable auto-dimming';

    const sunStatus =
      this.brightnessState.sunElevation > 0
        ? 'Daytime'
        : this.brightnessState.sunElevation > -6
        ? 'Civil twilight'
        : this.brightnessState.sunElevation > -12
        ? 'Nautical twilight'
        : 'Night';

    return `${enableDisableText} - ${sunStatus}`;
  }

  /** Get collapse/expand tooltip text */
  get collapseTooltip(): string {
    return this.collapsed ? 'Expand options' : 'Collapse options';
  }

  /** Get date/time toggle tooltip text */
  get dateTimeTooltip(): string {
    return this.showDateTime ? 'Hide date/time' : 'Show date/time';
  }

  /** Get airport labels toggle tooltip text */
  get airportLabelsTooltip(): string {
    return this.showAirportLabels
      ? 'Hide airport labels'
      : 'Show airport labels';
  }

  /** Get cloud cover toggle tooltip text */
  get cloudCoverTooltip(): string {
    return this.showCloudCover ? 'Hide cloud cover' : 'Show cloud cover';
  }

  /** Get rain cover toggle tooltip text */
  get rainCoverTooltip(): string {
    return this.showRainCover ? 'Hide rain cover' : 'Show rain cover';
  }
  /** Get view axes toggle tooltip text */
  get viewAxesTooltip(): string {
    return this.showViewAxes ? 'Hide view axes' : 'Show view axes';
  }

  /** Get altitude borders toggle tooltip text */
  get altitudeBordersTooltip(): string {
    return this.showAltitudeBorders
      ? 'Hide altitude-colored borders'
      : 'Show altitude-colored borders';
  }

  /** Get force scan tooltip text */
  get forceScanTooltip(): string {
    return 'Force scan now';
  }

  /** Get zoom in tooltip text */
  get zoomInTooltip(): string {
    return 'Zoom in';
  }

  /** Get zoom out tooltip text */
  get zoomOutTooltip(): string {
    return 'Zoom out';
  }
  /** Get go home tooltip text */
  get goHomeTooltip(): string {
    return 'Go to home';
  }

  /** Get brightness status text for custom tooltip */
  get brightnessStatusText(): string {
    if (!this.brightnessState) return '';

    if (this.brightnessState.mode === 'auto') {
      const sunStatus =
        this.brightnessState.sunElevation > 0
          ? 'Daytime'
          : this.brightnessState.sunElevation > -6
          ? 'Civil twilight'
          : this.brightnessState.sunElevation > -12
          ? 'Nautical twilight'
          : 'Night';
      return `${sunStatus} (${Math.round(
        this.brightnessState.brightness * 100
      )}%)`;
    }    return '';
  }

  /** Get distance unit label for display */
  getDistanceUnitLabel(): string {
    const unit = this.settings.distanceUnit as DistanceUnit;
    return getDistanceUnitLabel(unit);
  }  /** Get display radius value converted to current unit */  getDisplayRadius(): number {
    const radiusKm = this.settings.radius ?? 5;
    const unit = this.settings.distanceUnit as DistanceUnit;
    const converted = convertFromKm(radiusKm, unit);
    // Round to 2 decimal places for precision, then to 1 for display
    const precise = Math.round(converted * 100) / 100;
    const rounded = Math.round(precise * 10) / 10;
    return rounded;
  }  /**
   * Updates the radius input field with the correctly converted display value.
   * This should be called instead of directly setting the input field value.
   */
  updateRadiusInputDisplay(): void {
    // Don't update if user is actively editing the field
    if (this.isUserEditingRadius) {
      return;
    }
    
    if (this.searchRadiusInputRef?.nativeElement) {
      const displayValue = this.getDisplayRadius();
      this.searchRadiusInputRef.nativeElement.value = displayValue.toString();
    }
  }/** Toggle between kilometers and miles */
  toggleDistanceUnit(): void {
    const currentUnit = this.settings.distanceUnit;
    const newUnit = currentUnit === 'km' ? 'miles' : 'km';
    
    this.settings.setDistanceUnit(newUnit);
    
    // Temporarily allow update even if user was editing
    const wasEditing = this.isUserEditingRadius;
    this.isUserEditingRadius = false;
    
    // Update the display value using our dedicated method
    this.updateRadiusInputDisplay();
    
    // Restore editing state
    this.isUserEditingRadius = wasEditing;
  }
}
