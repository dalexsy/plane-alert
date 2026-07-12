import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import type { EnvironmentalState } from './environmental-types';
import {
  calculateAstronomicalData,
  convertWindSpeed,
  fetchWeatherData,
  getWindCompassDirection,
  getWindIntensityText,
  locationDistanceKm,
} from './environmental-calculations.util';

export type { AstronomicalData, EnvironmentalState, WeatherData } from './environmental-types';

@Injectable({ providedIn: 'root' })
export class EnvironmentalDataService {
  private readonly UPDATE_INTERVAL = 10 * 60 * 1000;
  private readonly ASTRONOMICAL_UPDATE_INTERVAL = 60 * 1000;
  private stateSubject = new BehaviorSubject<EnvironmentalState>({
    weather: null, astronomical: null, currentLocation: null, isLoading: false,
  });
  public state$ = this.stateSubject.asObservable();
  public weather$ = this.state$.pipe(map((s) => s.weather), distinctUntilChanged());
  public astronomical$ = this.state$.pipe(map((s) => s.astronomical), distinctUntilChanged());
  public isNight$ = this.astronomical$.pipe(map((d) => d?.isNight || false), distinctUntilChanged());
  public windData$ = this.weather$.pipe(
    map((w) => (w ? { direction: w.windDirection, speed: w.windSpeed, stat: w.windStat } : null)),
    distinctUntilChanged()
  );

  constructor() {
    interval(this.UPDATE_INTERVAL).pipe(startWith(0), switchMap(() => this.updateWeatherIfNeeded())).subscribe();
    interval(this.ASTRONOMICAL_UPDATE_INTERVAL).pipe(startWith(0), switchMap(() => this.updateAstronomicalIfNeeded())).subscribe();
  }

  setLocation(lat: number, lon: number): void {
    const current = this.stateSubject.value;
    const newLocation = { lat, lon };
    if (!current.currentLocation || locationDistanceKm(current.currentLocation, newLocation) > 0.1) {
      this.updateState({ currentLocation: newLocation });
      this.refreshEnvironmentalData();
    }
  }

  async refreshEnvironmentalData(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;
    this.updateState({ isLoading: true });
    try {
      const [weather, astronomical] = await Promise.all([
        fetchWeatherData(state.currentLocation.lat, state.currentLocation.lon),
        Promise.resolve(calculateAstronomicalData(state.currentLocation.lat, state.currentLocation.lon)),
      ]);
      this.updateState({ weather, astronomical, isLoading: false, error: undefined });
    } catch (error: any) {
      this.handleError(error);
    }
  }

  getWindCompassDirection = getWindCompassDirection;
  convertWindSpeed = convertWindSpeed;

  getWeatherSummary(): Observable<string> {
    return this.weather$.pipe(
      map((weather) => {
        if (!weather) return 'Weather data unavailable';
        return `${getWindCompassDirection(weather.windDirection)} ${getWindIntensityText(weather.windStat)}`;
      })
    );
  }

  getSunMoonEventDescription(): Observable<string> {
    return this.astronomical$.pipe(map((astro) => astro?.sunEventText || 'Calculating...'));
  }

  private async updateWeatherIfNeeded(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;
    const now = Date.now();
    if (!state.weather || now - state.weather.lastUpdated > this.UPDATE_INTERVAL) {
      try {
        this.updateState({
          weather: await fetchWeatherData(state.currentLocation.lat, state.currentLocation.lon),
        });
      } catch (error) {
        console.warn('Failed to update weather data:', error);
      }
    }
  }

  private async updateAstronomicalIfNeeded(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.currentLocation) return;
    const now = Date.now();
    if (!state.astronomical || now - state.astronomical.lastUpdated > this.ASTRONOMICAL_UPDATE_INTERVAL) {
      try {
        this.updateState({
          astronomical: calculateAstronomicalData(state.currentLocation.lat, state.currentLocation.lon),
        });
      } catch (error) {
        console.warn('Failed to update astronomical data:', error);
      }
    }
  }

  private updateState(updates: Partial<EnvironmentalState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...updates });
  }

  private handleError(error: any): void {
    console.error('EnvironmentalDataService error:', error);
    this.updateState({ error: error.message || 'Unknown environmental data error', isLoading: false });
  }
}
