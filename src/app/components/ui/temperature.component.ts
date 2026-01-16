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
import { SettingsService } from '../../services/settings.service';
import { DistanceUnit } from '../../utils/units.util';

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
  @Input() windowViewHidden = false;
  temperature: number | null = null;
  highTemp: number | null = null;
  lowTemp: number | null = null;
  loading = true;

  private locationSubscription?: Subscription;
  private refreshInterval?: number;

  constructor(
    private locationContext: LocationContextService,
    private settings: SettingsService // Inject SettingsService
  ) {}

  get isImperial(): boolean {
    return this.settings.distanceUnit === DistanceUnit.MILES;
  }

  get displayTemperature(): number | null {
    return this.convertIfNeeded(this.temperature);
  }
  get displayHighTemp(): number | null {
    return this.convertIfNeeded(this.highTemp);
  }
  get displayLowTemp(): number | null {
    return this.convertIfNeeded(this.lowTemp);
  }
  get tempUnitLabel(): string {
    return this.isImperial ? '°F' : '°C';
  }
  private convertIfNeeded(temp: number | null): number | null {
    if (temp == null) return null;
    return this.isImperial ? Math.round((temp * 9) / 5 + 32) : Math.round(temp);
  }

  ngOnInit(): void {
    // Subscribe to location changes and fetch temperature accordingly
    this.locationSubscription = this.locationContext.currentLocation$.subscribe(
      (location) => {
        if (location.lat !== undefined && location.lon !== undefined) {
          this.fetchTemperature(location.lat, location.lon);
        }
      }
    );

    // Set up refresh interval (every 10 minutes)
    this.refreshInterval = window.setInterval(() => {
      const location = this.locationContext.currentLocation;
      if (location.lat !== undefined && location.lon !== undefined) {
        this.fetchTemperature(location.lat, location.lon);
      }
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
    // Using OpenWeatherMap API (same as animations for consistency)
    const apiKey = 'ffcc03a274b2d049bf4633584e7b5699';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        this.temperature = data.main?.temp ?? null;
        this.highTemp = data.main?.temp_max ?? null;
        this.lowTemp = data.main?.temp_min ?? null;
        
        // Map OpenWeatherMap condition to Material Icon
        if (data.weather && data.weather.length > 0) {
          const condition = data.weather[0].main?.toLowerCase() || '';
          const description = data.weather[0].description?.toLowerCase() || '';
          
          if (condition.includes('clear')) {
            this.weatherIcon = 'wb_sunny';
          } else if (condition.includes('snow') || description.includes('snow')) {
            this.weatherIcon = 'ac_unit';
          } else if (condition.includes('rain') || condition.includes('drizzle')) {
            this.weatherIcon = 'rainy';
          } else if (condition.includes('thunderstorm')) {
            this.weatherIcon = 'thunderstorm';
          } else if (condition.includes('mist') || condition.includes('fog') || condition.includes('haze')) {
            this.weatherIcon = 'foggy';
          } else if (condition.includes('cloud')) {
            this.weatherIcon = 'wb_cloudy';
          } else {
            this.weatherIcon = 'wb_cloudy'; // default
          }
        }
        
        this.loading = false;
      })
      .catch((error) => {
        console.error('Weather API error:', error);
        this.temperature = null;
        this.highTemp = null;
        this.lowTemp = null;
        this.loading = false;
      });
  }
}
