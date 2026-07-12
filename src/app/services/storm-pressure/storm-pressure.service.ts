import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import {
  analyzeStormPressure,
  describeStormPressure,
  STORM_PRESSURE_THRESHOLDS,
} from './storm-pressure-analyze.util';

export interface StormPressureAnalysis {
  currentPressure: number;
  normalPressure: number;
  dropIntensity: number;
  isStormApproaching: boolean;
  stormSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class StormPressureService {
  private currentAnalysis$ = new BehaviorSubject<StormPressureAnalysis>({
    currentPressure: STORM_PRESSURE_THRESHOLDS.NORMAL_SEA_LEVEL,
    normalPressure: STORM_PRESSURE_THRESHOLDS.NORMAL_SEA_LEVEL,
    dropIntensity: 0,
    isStormApproaching: false,
    stormSeverity: 'none',
    confidence: 0,
  });

  private pressureHistory: Array<{ pressure: number; timestamp: number }> = [];
  private readonly HISTORY_DURATION = 3 * 60 * 60 * 1000;

  public getStormAnalysis(): Observable<StormPressureAnalysis> {
    return this.currentAnalysis$.asObservable().pipe(
      distinctUntilChanged(
        (prev, curr) =>
          prev.isStormApproaching === curr.isStormApproaching &&
          prev.dropIntensity === curr.dropIntensity &&
          prev.stormSeverity === curr.stormSeverity,
      ),
      debounceTime(1000),
    );
  }

  public shouldShowSwallows(): Observable<boolean> {
    return this.currentAnalysis$.pipe(
      map(
        (analysis) =>
          analysis.isStormApproaching && analysis.dropIntensity > 0.3,
      ),
      distinctUntilChanged(),
    );
  }

  public getSwallowIntensity(): Observable<number> {
    return this.currentAnalysis$.pipe(
      map((analysis) =>
        analysis.isStormApproaching ? analysis.dropIntensity : 0,
      ),
      distinctUntilChanged(),
    );
  }

  public updatePressure(
    pressure: number,
    temperature?: number,
    humidity?: number,
    windSpeed?: number,
  ): void {
    const now = Date.now();
    this.pressureHistory.push({ pressure, timestamp: now });
    this.pressureHistory = this.pressureHistory.filter(
      (entry) => now - entry.timestamp < this.HISTORY_DURATION,
    );

    this.currentAnalysis$.next(
      analyzeStormPressure(
        pressure,
        this.pressureHistory,
        temperature,
        humidity,
        windSpeed,
      ),
    );
  }

  public getPressureDescription(): Observable<string> {
    return this.currentAnalysis$.pipe(
      map((analysis) => describeStormPressure(analysis)),
    );
  }

  public resetHistory(): void {
    this.pressureHistory = [];
    this.currentAnalysis$.next({
      currentPressure: STORM_PRESSURE_THRESHOLDS.NORMAL_SEA_LEVEL,
      normalPressure: STORM_PRESSURE_THRESHOLDS.NORMAL_SEA_LEVEL,
      dropIntensity: 0,
      isStormApproaching: false,
      stormSeverity: 'none',
      confidence: 0,
    });
  }
}
