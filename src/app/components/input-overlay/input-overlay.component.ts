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
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
// removed FormsModule import, using native form submission
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
  @ViewChild('addressInput', { static: false })
  addressInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('searchRadiusInput', { static: false })
  searchRadiusInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('checkIntervalInput', { static: false })
  checkIntervalInputRef!: ElementRef<HTMLInputElement>;

  @Output() resolveAndUpdate = new EventEmitter<void>();
  @Output() useCurrentLocation = new EventEmitter<void>();
  @Output() goToAirport = new EventEmitter<void>();
  @Output() coneVisibilityChange = new EventEmitter<boolean>();
  @Output() setHome = new EventEmitter<void>();
  @Output() goToHome = new EventEmitter<void>();
  @Input() showCloudCover = true;
  @Output() cloudToggleChange = new EventEmitter<boolean>();
  @Input() showDateTime = true;
  @Output() toggleDateTimeOverlays = new EventEmitter<void>();
  /** Whether to show view axes (cones) */
  @Input() showViewAxes = false;

  scanButtonText = '';
  private sub!: Subscription;
  collapsed = localStorage.getItem('inputOverlayCollapsed') === 'true';
  public currentAddress: string = '';

  constructor(
    public settings: SettingsService,
    private cdr: ChangeDetectorRef,
    private scanService: ScanService
  ) {}

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
        const displayedInterval = (this.settings.interval / 60).toString();
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
    console.log('[InputOverlay] onResolveAndUpdate called', {
      address: this.addressInputRef?.nativeElement.value,
      radius: this.searchRadiusInputRef?.nativeElement.value,
      interval: this.checkIntervalInputRef?.nativeElement.value,
    });
    // Prevent the browser from reloading the page on form submit
    event?.preventDefault();
    console.info('[PlaneAlert] Update now button pressed');
    this.resolveAndUpdate.emit();
  }

  onUseCurrentLocation(): void {
    this.useCurrentLocation.emit();
  }

  onGoToAirport(): void {
    this.goToAirport.emit();
  }

  onRadiusChange(): void {
    const val = this.searchRadiusInputRef.nativeElement.valueAsNumber;
    if (!isNaN(val)) {
      this.settings.setRadius(val);
    }
  }

  onIntervalChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const minutes = input.valueAsNumber;
    if (isNaN(minutes)) {
      return;
    }
    const newInterval = minutes * 60;
    this.settings.interval = newInterval;
    this.scanService.updateInterval(newInterval);
  }

  onShowConeChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.coneVisibilityChange.emit(checked);
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
}
