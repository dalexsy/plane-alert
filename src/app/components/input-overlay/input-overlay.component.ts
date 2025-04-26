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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { ScanService } from '../../services/scan.service';
import { Subscription, combineLatest } from 'rxjs';
import { ButtonComponent } from '../ui/button.component';

@Component({
  selector: 'app-input-overlay',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './input-overlay.component.html',
  styleUrls: ['./input-overlay.component.scss'],
})
export class InputOverlayComponent implements AfterViewInit, OnDestroy {
  @ViewChild('addressInput', { static: true })
  addressInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('searchRadiusInput', { static: true })
  searchRadiusInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('checkIntervalInput', { static: true })
  checkIntervalInputRef!: ElementRef<HTMLInputElement>;

  @Output() resolveAndUpdate = new EventEmitter<void>();
  @Output() useCurrentLocation = new EventEmitter<void>();
  @Output() goToAirport = new EventEmitter<void>();
  @Output() coneVisibilityChange = new EventEmitter<boolean>();
  @Output() setHome = new EventEmitter<void>();
  @Output() goToHome = new EventEmitter<void>();

  scanButtonText = '';
  private sub!: Subscription;
  collapsed = false;

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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onResolveAndUpdate(event?: Event): void {
    console.log('[InputOverlayComponent] onResolveAndUpdate called');
    // Prevent the browser from reloading the page on form submit
    event?.preventDefault();
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

  onIntervalChange(): void {
    const minutes = this.checkIntervalInputRef.nativeElement.valueAsNumber;
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

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.cdr.detectChanges();
  }
}
