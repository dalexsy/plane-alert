import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Renderer2,
} from '@angular/core';
import { LocationContextService } from '../../services/location-context.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clock',
  standalone: true,
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
})
export class ClockComponent implements OnInit, OnDestroy, AfterViewInit {
  currentTime = '';
  weekday = '';
  dayMonth = '';

  private updateInterval?: number;
  private locationSubscription?: Subscription;
  private resizeListener?: () => void;

  constructor(
    private locationContext: LocationContextService,
    private renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {
    this.updateClockVar();
    this.resizeListener = this.renderer.listen('window', 'resize', () =>
      this.updateClockVar()
    );
  }

  ngOnInit(): void {
    // Subscribe to location/timezone changes
    this.locationSubscription = this.locationContext.timezone$.subscribe(() => {
      this.updateTime();
    });

    this.updateTime();
    this.updateInterval = window.setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    // Remove resize listener
    if (this.resizeListener) {
      this.resizeListener();
    }
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
    }
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }

  private updateClockVar(): void {
    const el = document.querySelector('app-clock .clock-container');
    if (el) {
      const computedBottom = window.getComputedStyle(el).bottom;
      // set CSS var on root
      this.renderer.setStyle(
        document.documentElement,
        '--clock-bottom',
        computedBottom
      );
    }
  }

  private updateTime(): void {
    this.weekday = this.locationContext.formatDateForLocation({
      weekday: 'long',
    });
    this.dayMonth = this.locationContext.formatDateForLocation({
      day: 'numeric',
      month: 'long',
    });
    this.currentTime = this.locationContext.formatTimeForLocation({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
