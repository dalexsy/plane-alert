import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { LocationContextService } from '../../services/location-context.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-temperature',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './temperature.component.html',
  styleUrls: ['./temperature.component.scss'],
})
export class TemperatureComponent implements OnInit, OnDestroy {
  weatherIcon: string = 'wb_sunny';
  @Input() resultsCollapsed = false;
  @HostBinding('class.collapsed') get collapsed() {
    return this.resultsCollapsed;
  }
  temperature: number | null = null;
  highTemp: number | null = null;
  lowTemp: number | null = null;
  loading = true;

  private locationSubscription?: Subscription;
  private refreshInterval?: number;

  constructor(private locationContext: LocationContextService) {}
  ngOnInit(): void {
    // Subscribe to location changes and fetch temperature accordingly
    this.locationSubscription = this.locationContext.currentLocation$.subscribe(
      (location) => {
        this.fetchTemperature(location.lat, location.lon);
      }
    );

    // Set up refresh interval (every 10 minutes)
    this.refreshInterval = window.setInterval(() => {
      const location = this.locationContext.currentLocation;
      this.fetchTemperature(location.lat, location.lon);
    }, 600000);
  }

  ngOnDestroy(): void {
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
    }
  }

  private fetchTemperature(latitude: number, longitude: number): void {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    )
      .then((res) => res.json())
      .then((data) => {
        this.temperature = data.current_weather?.temperature ?? null;
        // optionally update weatherIcon based on weathercode if available
        if (data.current_weather?.weathercode != null) {
          // basic mapping, sun for clear
          this.weatherIcon =
            data.current_weather.weathercode === 0 ? 'wb_sunny' : 'wb_cloudy';
        }
        this.highTemp = data.daily?.temperature_2m_max?.[0] ?? null;
        this.lowTemp = data.daily?.temperature_2m_min?.[0] ?? null;
        this.loading = false;
      })
      .catch(() => {
        this.temperature = null;
        this.highTemp = null;
        this.lowTemp = null;
        this.loading = false;
      });
  }
}
