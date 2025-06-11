import { Component, OnInit, OnDestroy } from '@angular/core';
import { LocationContextService } from '../../services/location-context.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clock',
  standalone: true,
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
})
export class ClockComponent implements OnInit, OnDestroy {
  currentTime = '';
  weekday = '';
  dayMonth = '';

  private updateInterval?: number;
  private locationSubscription?: Subscription;

  constructor(private locationContext: LocationContextService) {}

  ngOnInit(): void {
    // Subscribe to location/timezone changes
    this.locationSubscription = this.locationContext.timezone$.subscribe(() => {
      this.updateTime();
    });

    this.updateTime();
    this.updateInterval = window.setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
    }
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }

  private updateTime(): void {
    const locationTime = this.locationContext.getCurrentTimeForLocation();

    this.weekday = locationTime.toLocaleDateString('en-GB', {
      weekday: 'long',
    });
    this.dayMonth = locationTime.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
    });
    this.currentTime = locationTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
