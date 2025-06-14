/**
 * Environmental Data Service
 * Handles weather data, astronomical calculations, and environmental conditions
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, combineLatest } from 'rxjs';
import { map, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import SunCalc from 'suncalc';

export interface WeatherData {
  windDirection: number; // degrees
  windSpeed: number; // m/s
  windStat: number; // intensity 0-3
  temperature?: number; // celsius
  humidity?: number; // percentage
  pressure?: number; // hPa
  lastUpdated: number;
}

export interface AstronomicalData {
  sunAngle: number; // degrees
  moonAngle: number; // degrees
  isNight: boolean;
  moonFraction: number; // 0-1
  moonPhase: string;
  moonIsWaning: boolean;
  sunEventText: string; // "Sunset in 3h 45m" or "Sunrise in 5h 12m"
  lastUpdated: number;
}

export interface EnvironmentalState {
  weather: WeatherData | null;
  astronomical: AstronomicalData | null;
  currentLocation: { lat: number; lon: number } | null;
  isLoading: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class EnvironmentalDataService {
  private readonly WEATHER_API_KEY = 'ffcc03a274b2d049bf4633584e7b5699'; // OpenWeatherMap
  private readonly UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly ASTRONOMICAL_UPDATE_INTERVAL = 60 * 1000; // 1 minute

  private stateSubject = new BehaviorSubject<EnvironmentalState>({
    weather: null,
    astronomical: null,
    currentLocation: null,
    isLoading: false,
  });

  public state$ = this.stateSubject.asObservable();

  // Derived observables
  public weather$ = this.state$.pipe(
    map((state) => state.weather),
    distinctUntilChanged()
  );

  public astronomical$ = this.state$.pipe(
    map((state) => state.astronomical),
    distinctUntilChanged()
  );

  public isNight$ = this.astronomical$.pipe(
    map((data) => data?.isNight || false),
    distinctUntilChanged()
  );

  public windData$ = this.weather$.pipe(
    map((weather) =>
      weather
        ? {
            direction: weather.windDirection,
            speed: weather.windSpeed,
            stat: weather.windStat,
          }
        : null
    ),
    distinctUntilChanged()
  );

  constructor() {
    this.startPeriodicUpdates();
  }

  /**
   * Set the current location for environmental data
   */
  setLocation(lat: number, lon: number): void {
    const currentState = this.stateSubject.value;
    const newLocation = { lat, lon };

    // Only update if location has changed significantly (>100m)
    if (
      !currentState.currentLocation ||
      this.calculateDistance(currentState.currentLocation, newLocation) > 0.1
    ) {
      this.updateState({ currentLocation: newLocation });
      this.refreshEnvironmentalData();
    }
  }

  /**
   * Manually refresh all environmental data
   */
  async refreshEnvironmentalData(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;

    this.updateState({ isLoading: true });

    try {
      const [weather, astronomical] = await Promise.all([
        this.fetchWeatherData(
          state.currentLocation.lat,
          state.currentLocation.lon
        ),
        this.calculateAstronomicalData(
          state.currentLocation.lat,
          state.currentLocation.lon
        ),
      ]);

      this.updateState({
        weather,
        astronomical,
        isLoading: false,
        error: undefined,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get wind direction as compass point (N, NE, E, etc.)
   */
  getWindCompassDirection(degrees: number): string {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const index = Math.round((degrees % 360) / 22.5) % 16;
    return directions[index];
  }

  /**
   * Convert wind speed from m/s to specified unit
   */
  convertWindSpeed(speedMs: number, unit: string): number {
    switch (unit) {
      case 'knots':
        return speedMs * 1.94384;
      case 'km/h':
        return speedMs * 3.6;
      case 'mph':
        return speedMs * 2.23694;
      default:
        return speedMs; // m/s
    }
  }

  /**
   * Get current weather summary
   */
  getWeatherSummary(): Observable<string> {
    return this.weather$.pipe(
      map((weather) => {
        if (!weather) return 'Weather data unavailable';

        const direction = this.getWindCompassDirection(weather.windDirection);
        const intensity = this.getWindIntensityText(weather.windStat);

        return `${direction} ${intensity}`;
      })
    );
  }

  /**
   * Get sun/moon event description
   */
  getSunMoonEventDescription(): Observable<string> {
    return this.astronomical$.pipe(
      map((astro) => astro?.sunEventText || 'Calculating...')
    );
  }

  /**
   * Start periodic updates for environmental data
   */
  private startPeriodicUpdates(): void {
    // Weather updates every 10 minutes
    interval(this.UPDATE_INTERVAL)
      .pipe(
        startWith(0),
        switchMap(() => this.updateWeatherIfNeeded())
      )
      .subscribe();

    // Astronomical updates every minute
    interval(this.ASTRONOMICAL_UPDATE_INTERVAL)
      .pipe(
        startWith(0),
        switchMap(() => this.updateAstronomicalIfNeeded())
      )
      .subscribe();
  }

  /**
   * Update weather data if needed
   */
  private async updateWeatherIfNeeded(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;

    const now = Date.now();
    const shouldUpdate =
      !state.weather || now - state.weather.lastUpdated > this.UPDATE_INTERVAL;

    if (shouldUpdate) {
      try {
        const weather = await this.fetchWeatherData(
          state.currentLocation.lat,
          state.currentLocation.lon
        );
        this.updateState({ weather });
      } catch (error) {
        console.warn('Failed to update weather data:', error);
      }
    }
  }

  /**
   * Update astronomical data if needed
   */
  private async updateAstronomicalIfNeeded(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;

    const now = Date.now();
    const shouldUpdate =
      !state.astronomical ||
      now - state.astronomical.lastUpdated > this.ASTRONOMICAL_UPDATE_INTERVAL;

    if (shouldUpdate) {
      try {
        const astronomical = this.calculateAstronomicalData(
          state.currentLocation.lat,
          state.currentLocation.lon
        );
        this.updateState({ astronomical });
      } catch (error) {
        console.warn('Failed to update astronomical data:', error);
      }
    }
  }

  /**
   * Fetch weather data from OpenWeatherMap API
   */
  private async fetchWeatherData(
    lat: number,
    lon: number
  ): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.WEATHER_API_KEY}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Calculate wind intensity based on speed
    const windSpeed = data.wind?.speed || 0;
    let windStat = 0;
    if (windSpeed >= 6) windStat = 3;
    else if (windSpeed >= 3) windStat = 2;
    else if (windSpeed >= 0.5) windStat = 1;

    return {
      windDirection: data.wind?.deg || 0,
      windSpeed: windSpeed,
      windStat: windStat,
      temperature: data.main?.temp,
      humidity: data.main?.humidity,
      pressure: data.main?.pressure,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Calculate astronomical data using SunCalc
   */
  private calculateAstronomicalData(
    lat: number,
    lon: number
  ): AstronomicalData {
    const now = new Date();

    // Calculate sun position
    const sunPos = SunCalc.getPosition(now, lat, lon);
    const sunAzimuthDeg = (sunPos.azimuth * 180) / Math.PI;
    const sunAngle = (sunAzimuthDeg + 180) % 360;

    // Calculate moon position and phase
    const moonPos = SunCalc.getMoonPosition(now, lat, lon);
    const moonIllum = SunCalc.getMoonIllumination(now);
    const moonAzimuthDeg = (moonPos.azimuth * 180) / Math.PI;
    const moonAngle = (moonAzimuthDeg + 180) % 360;

    // Determine if it's night
    const isNight = sunPos.altitude < 0;

    // Calculate moon phase name
    const moonPhase = this.getMoonPhaseName(moonIllum.phase);

    // Calculate next sun event
    const sunEventText = this.calculateNextSunEvent(now, lat, lon, isNight);

    return {
      sunAngle: isNight ? moonAngle : sunAngle, // Use moon angle during night
      moonAngle,
      isNight,
      moonFraction: moonIllum.fraction,
      moonPhase,
      moonIsWaning: moonIllum.phase > 0.5,
      sunEventText,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get moon phase name from phase value
   */
  private getMoonPhaseName(phase: number): string {
    if (phase < 0.1 || phase > 0.9) return 'New Moon';
    if (phase < 0.3) return 'Waxing Crescent';
    if (phase < 0.4) return 'First Quarter';
    if (phase < 0.6) return 'Waxing Gibbous';
    if (phase < 0.7) return 'Full Moon';
    if (phase < 0.9) return 'Waning Gibbous';
    return 'Last Quarter';
  }

  /**
   * Calculate next sun event (sunrise or sunset)
   */
  private calculateNextSunEvent(
    now: Date,
    lat: number,
    lon: number,
    isNight: boolean
  ): string {
    const sunTimes = SunCalc.getTimes(now, lat, lon);
    const currentTime = now.getTime();

    if (isNight) {
      // Find next sunrise
      let sunriseDate = sunTimes.sunrise;
      if (sunriseDate.getTime() <= currentTime) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        sunriseDate = SunCalc.getTimes(tomorrow, lat, lon).sunrise;
      }

      const timeUntil = Math.max(0, sunriseDate.getTime() - currentTime);
      const { hours, minutes } = this.millisecondsToHoursMinutes(timeUntil);
      return `Sunrise ${hours}h ${minutes}m`;
    } else {
      // Find next sunset
      const timeUntil = Math.max(0, sunTimes.sunset.getTime() - currentTime);
      const { hours, minutes } = this.millisecondsToHoursMinutes(timeUntil);
      return `Sunset ${hours}h ${minutes}m`;
    }
  }

  /**
   * Convert milliseconds to hours and minutes
   */
  private millisecondsToHoursMinutes(ms: number): {
    hours: number;
    minutes: number;
  } {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  }

  /**
   * Get wind intensity text description
   */
  private getWindIntensityText(stat: number): string {
    switch (stat) {
      case 0:
        return 'Calm';
      case 1:
        return 'Light';
      case 2:
        return 'Moderate';
      case 3:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }

  /**
   * Calculate distance between two points (simplified)
   */
  private calculateDistance(
    point1: { lat: number; lon: number },
    point2: { lat: number; lon: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Update state immutably
   */
  private updateState(updates: Partial<EnvironmentalState>): void {
    const currentState = this.stateSubject.value;
    const newState = { ...currentState, ...updates };
    this.stateSubject.next(newState);
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    console.error('EnvironmentalDataService error:', error);
    this.updateState({
      error: error.message || 'Unknown environmental data error',
      isLoading: false,
    });
  }
}
