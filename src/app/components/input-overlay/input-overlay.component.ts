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
import { Subscription, combineLatest } from 'rxjs';
import { ButtonComponent } from '../ui/button.component';
import { TabComponent } from '../ui/tab.component';

@Component({
  selector: 'app-input-overlay',
  standalone: true,
  imports: [CommonModule, ButtonComponent, TabComponent],
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
  @Output() brightnessToggle = new EventEmitter<void>();
  /** Emit when zoom in button is clicked */
  @Output() zoomIn = new EventEmitter<void>();
  /** Emit when zoom out button is clicked */
  @Output() zoomOut = new EventEmitter<void>();
  /** Whether to show view axes (cones) */
  @Input() showViewAxes = false;

  scanButtonText = '';
  private sub!: Subscription;
  @HostBinding('class.collapsed')
  collapsed: boolean = localStorage.getItem('inputOverlayCollapsed') === 'true';
  public currentAddress: string = '';

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
      this.cdr.detectChanges();
    });

    // Only set input values if not collapsed and refs exist
    if (!this.collapsed) {
      if (this.searchRadiusInputRef?.nativeElement) {
        const radius = this.settings.radius ?? 5;
        this.searchRadiusInputRef.nativeElement.value = radius.toString();
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
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onResolveAndUpdate(event?: Event): void {
    // Prevent the browser from reloading the page on form submit
    event?.preventDefault();
    // Update now button pressed would be logged here
    this.resolveAndUpdate.emit();
  }
  onUseCurrentLocation(): void {
    this.useCurrentLocation.emit();
  }

  onRadiusChange(): void {
    const val = this.searchRadiusInputRef.nativeElement.valueAsNumber;
    if (!isNaN(val)) {
      this.settings.setRadius(val);
    }
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
}
