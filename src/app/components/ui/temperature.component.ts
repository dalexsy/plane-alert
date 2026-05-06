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
import { weatherCeilingEndpoint } from '../../config/firebase.config';

@Component({
  selector: 'app-temperature',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './temperature.component.html',
  styleUrls: ['./temperature.component.scss'],
})
export class TemperatureComponent implements OnInit, OnDestroy {
  private readonly weatherCacheKey = 'lastWeatherOverlaySnapshot';
  weatherIcon: string = 'wb_sunny';
  @Input() resultsCollapsed = false;
  @HostBinding('class.collapsed') get collapsed() {
    return this.resultsCollapsed;
  }
  @Input() windowViewHidden = false;
  temperature: number | null = null;
  highTemp: number | null = null;
  lowTemp: number | null = null;
  cloudCeilingFeet: number | null = null;
  cloudCeilingDisplayLabel = 'Ceiling --';
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
  get displayCloudCeiling(): string {
    return this.cloudCeilingDisplayLabel;
  }

  private convertIfNeeded(temp: number | null): number | null {
    if (temp == null) return null;
    return this.isImperial ? Math.round((temp * 9) / 5 + 32) : Math.round(temp);
  }

  ngOnInit(): void {
    this.restoreCachedWeather();

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

  private async fetchJsonWithTimeout(
    url: string,
    timeoutMs = 8000
  ): Promise<any | null> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private async fetchTemperature(latitude: number, longitude: number): Promise<void> {
    this.loading = true;

    // OpenWeatherMap is used for current condition icon and temperature.
    const apiKey = 'ffcc03a274b2d049bf4633584e7b5699';
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;

    // Open-Meteo provides full-day highs/lows and current cloud base height.
    const dailyWeatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=cloud_base,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

    try {
      const [currentResult, dailyResult, metarResult] = await Promise.allSettled([
        this.fetchJsonWithTimeout(currentWeatherUrl, 8000),
        this.fetchJsonWithTimeout(dailyWeatherUrl, 8000),
        this.fetchNearestAirportCeiling(latitude, longitude),
      ]);

      const currentWeatherData =
        currentResult.status === 'fulfilled' ? currentResult.value : null;
      const dailyWeatherData =
        dailyResult.status === 'fulfilled' ? dailyResult.value : null;
      const metarCeiling =
        metarResult.status === 'fulfilled'
          ? metarResult.value
          : { feet: null, stationCode: null, kind: 'unavailable' as const };

      if (currentWeatherData?.main?.temp != null) {
        this.temperature = currentWeatherData.main.temp;
      }

      const dailyHighLow = this.extractDailyHighLow(dailyWeatherData);
      if (dailyHighLow?.high != null) {
        this.highTemp = dailyHighLow.high;
      } else if (currentWeatherData?.main?.temp_max != null) {
        this.highTemp = currentWeatherData.main.temp_max;
      }

      if (dailyHighLow?.low != null) {
        this.lowTemp = dailyHighLow.low;
      } else if (currentWeatherData?.main?.temp_min != null) {
        this.lowTemp = currentWeatherData.main.temp_min;
      }

      const modelCloudFeet = this.extractCloudCeilingFeet(dailyWeatherData);
      if (modelCloudFeet != null) {
        this.cloudCeilingFeet = modelCloudFeet;
      }
      this.cloudCeilingDisplayLabel = this.buildCloudCeilingLabel(metarCeiling);

      this.applyWeatherIcon(currentWeatherData);
      this.persistCachedWeather();
    } catch (error) {
      console.error('Weather API error:', error);
      this.cloudCeilingDisplayLabel = this.cloudCeilingDisplayLabel || 'Ceiling --';
    } finally {
      this.loading = false;
    }
  }

  private persistCachedWeather(): void {
    try {
      const snapshot = {
        weatherIcon: this.weatherIcon,
        temperature: this.temperature,
        highTemp: this.highTemp,
        lowTemp: this.lowTemp,
        cloudCeilingFeet: this.cloudCeilingFeet,
        cloudCeilingDisplayLabel: this.cloudCeilingDisplayLabel,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.weatherCacheKey, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures; live values are still displayed.
    }
  }

  private restoreCachedWeather(): void {
    try {
      const raw = localStorage.getItem(this.weatherCacheKey);
      if (!raw) {
        return;
      }

      const cached = JSON.parse(raw);
      if (typeof cached.weatherIcon === 'string' && cached.weatherIcon.trim()) {
        this.weatherIcon = cached.weatherIcon;
      }
      if (Number.isFinite(cached.temperature)) {
        this.temperature = Number(cached.temperature);
      }
      if (Number.isFinite(cached.highTemp)) {
        this.highTemp = Number(cached.highTemp);
      }
      if (Number.isFinite(cached.lowTemp)) {
        this.lowTemp = Number(cached.lowTemp);
      }
      if (Number.isFinite(cached.cloudCeilingFeet)) {
        this.cloudCeilingFeet = Number(cached.cloudCeilingFeet);
      }
      if (
        typeof cached.cloudCeilingDisplayLabel === 'string' &&
        cached.cloudCeilingDisplayLabel.trim()
      ) {
        this.cloudCeilingDisplayLabel = cached.cloudCeilingDisplayLabel;
      }

      // Keep overlay visible immediately with cached snapshot.
      this.loading = false;
    } catch {
      // Ignore malformed cache and continue with live fetch.
    }
  }

  private buildCloudCeilingLabel(metarCeiling: {
    feet: number | null;
    stationCode: string | null;
    kind: 'ceiling' | 'cloud-base' | 'above-threshold' | 'unavailable';
  }): string {
    if (metarCeiling.kind === 'above-threshold') {
      if (this.cloudCeilingFeet != null) {
        return this.formatCompactBothUnits(this.cloudCeilingFeet);
      }

      const source = metarCeiling.stationCode
        ? ` (${metarCeiling.stationCode})`
        : '';
      return `${this.formatCompactBothUnits(5000, true)}${source}`;
    }

    if (metarCeiling.kind === 'ceiling' && metarCeiling.feet != null) {
      const source = metarCeiling.stationCode
        ? ` (${metarCeiling.stationCode})`
        : '';
      return `${this.formatCompactBothUnits(metarCeiling.feet)}${source}`;
    }

    if (metarCeiling.kind === 'cloud-base' && metarCeiling.feet != null) {
      const source = metarCeiling.stationCode
        ? ` (${metarCeiling.stationCode})`
        : '';
      return `${this.formatCompactBothUnits(metarCeiling.feet)}${source}`;
    }

    if (this.cloudCeilingFeet != null) {
      return this.formatCompactBothUnits(this.cloudCeilingFeet);
    }

    return '--';
  }

  private formatCeilingHeight(feet: number): string {
    if (this.isImperial) {
      return `${Math.round(feet).toLocaleString()}ft`;
    }

    const meters = Math.round(feet * 0.3048);
    return `${meters.toLocaleString()}m`;
  }

  private formatCompactBothUnits(feet: number, above = false): string {
    const meters = feet * 0.3048;
    const prefix = above ? '>' : '';
    const compactMeters = `${prefix}${(meters / 1000).toFixed(1)}k m`;
    const compactFeet = `${prefix}${(feet / 1000).toFixed(1)}k ft`;
    return `${compactMeters} / ${compactFeet}`;
  }

  private async fetchNearestAirportCeiling(
    latitude: number,
    longitude: number
  ): Promise<{
    feet: number | null;
    stationCode: string | null;
    kind: 'ceiling' | 'cloud-base' | 'above-threshold' | 'unavailable';
  }> {
    try {
      const url = `${weatherCeilingEndpoint}?lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url);
      if (!response.ok) {
        return { feet: null, stationCode: null, kind: 'unavailable' };
      }

      const data = await response.json();
      const kind =
        data?.kind === 'ceiling' ||
        data?.kind === 'cloud-base' ||
        data?.kind === 'above-threshold' ||
        data?.kind === 'unavailable'
          ? data.kind
          : 'unavailable';

      const feet = Number.isFinite(data?.feet) ? Number(data.feet) : null;
      const stationCode =
        typeof data?.stationCode === 'string' && data.stationCode.length === 3
          ? data.stationCode.toUpperCase()
          : null;

      return { feet, stationCode, kind };
    } catch {
      return { feet: null, stationCode: null, kind: 'unavailable' };
    }
  }

  private extractCloudCeilingFeet(weatherData: any): number | null {
    const current = weatherData?.current || {};
    const cloudCeilingMeters = current.cloud_base;

    if (Number.isFinite(cloudCeilingMeters)) {
      return Math.round(cloudCeilingMeters * 3.28084);
    }

    const low = Number(current.cloud_cover_low);
    const mid = Number(current.cloud_cover_mid);
    const high = Number(current.cloud_cover_high);

    if (Number.isFinite(low) && low >= 35) {
      return Math.round(1500 * 3.28084);
    }
    if (Number.isFinite(mid) && mid >= 35) {
      return Math.round(4500 * 3.28084);
    }
    if (Number.isFinite(high) && high >= 35) {
      return Math.round(9000 * 3.28084);
    }

    return null;
  }

  private extractDailyHighLow(
    weatherData: any
  ): { high: number | null; low: number | null } | null {
    const daily = weatherData?.daily;
    if (!daily?.time?.length) {
      return null;
    }

    const timezone = weatherData?.timezone;
    const todayKey = this.getDateKeyForTimezone(timezone);
    const dayIndex = daily.time.indexOf(todayKey);
    const targetIndex = dayIndex >= 0 ? dayIndex : 0;

    const high = daily.temperature_2m_max?.[targetIndex] ?? null;
    const low = daily.temperature_2m_min?.[targetIndex] ?? null;

    if (high == null && low == null) {
      return null;
    }

    return { high, low };
  }

  private getDateKeyForTimezone(timezone?: string): string {
    try {
      if (timezone) {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return formatter.format(new Date());
      }
    } catch {
      // Fall back to local date formatting if timezone is invalid.
    }

    return new Date().toISOString().slice(0, 10);
  }

  private applyWeatherIcon(weatherData: any): void {
    if (!(weatherData?.weather?.length > 0)) {
      return;
    }

    const condition = weatherData.weather[0].main?.toLowerCase() || '';
    const description = weatherData.weather[0].description?.toLowerCase() || '';

    if (condition.includes('clear')) {
      this.weatherIcon = 'wb_sunny';
    } else if (condition.includes('snow') || description.includes('snow')) {
      this.weatherIcon = 'ac_unit';
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
      this.weatherIcon = 'rainy';
    } else if (condition.includes('thunderstorm')) {
      this.weatherIcon = 'thunderstorm';
    } else if (
      condition.includes('mist') ||
      condition.includes('fog') ||
      condition.includes('haze')
    ) {
      this.weatherIcon = 'foggy';
    } else if (condition.includes('cloud')) {
      this.weatherIcon = 'wb_cloudy';
    } else {
      this.weatherIcon = 'wb_cloudy';
    }
  }
}
