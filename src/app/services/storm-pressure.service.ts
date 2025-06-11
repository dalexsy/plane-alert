import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged, debounceTime } from 'rxjs/operators';

/**
 * Storm pressure analysis result
 */
export interface StormPressureAnalysis {
  /** Current atmospheric pressure in hPa */
  currentPressure: number;
  /** Normal/average pressure for the region (baseline) */
  normalPressure: number;
  /** Pressure drop intensity (0-1 scale) */
  dropIntensity: number;
  /** Whether conditions indicate approaching storm */
  isStormApproaching: boolean;
  /** Storm severity rating */
  stormSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  /** Confidence in storm prediction (0-1) */
  confidence: number;
}

/**
 * Service for monitoring atmospheric pressure and predicting storms
 * Triggers swallow animations when pressure drops indicate approaching storms
 */
@Injectable({
  providedIn: 'root',
})
export class StormPressureService {
  private readonly NORMAL_SEA_LEVEL_PRESSURE = 1013.25; // hPa
  private readonly STORM_PRESSURE_THRESHOLD = 995; // hPa - below this indicates storm potential
  private readonly SEVERE_STORM_THRESHOLD = 980; // hPa - severe storm conditions

  private currentAnalysis$ = new BehaviorSubject<StormPressureAnalysis>({
    currentPressure: this.NORMAL_SEA_LEVEL_PRESSURE,
    normalPressure: this.NORMAL_SEA_LEVEL_PRESSURE,
    dropIntensity: 0,
    isStormApproaching: false,
    stormSeverity: 'none',
    confidence: 0,
  });

  private pressureHistory: Array<{ pressure: number; timestamp: number }> = [];
  private readonly HISTORY_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  constructor() {}

  /**
   * Get current storm pressure analysis
   */
  public getStormAnalysis(): Observable<StormPressureAnalysis> {
    return this.currentAnalysis$.asObservable().pipe(
      distinctUntilChanged(
        (prev, curr) =>
          prev.isStormApproaching === curr.isStormApproaching &&
          prev.dropIntensity === curr.dropIntensity &&
          prev.stormSeverity === curr.stormSeverity
      ),
      debounceTime(1000) // Prevent rapid updates
    );
  }

  /**
   * Check if swallows should be active based on pressure
   */
  public shouldShowSwallows(): Observable<boolean> {
    return this.currentAnalysis$.pipe(
      map(
        (analysis) =>
          analysis.isStormApproaching && analysis.dropIntensity > 0.3
      ),
      distinctUntilChanged()
    );
  }

  /**
   * Get swallow animation intensity based on pressure conditions
   */
  public getSwallowIntensity(): Observable<number> {
    return this.currentAnalysis$.pipe(
      map((analysis) =>
        analysis.isStormApproaching ? analysis.dropIntensity : 0
      ),
      distinctUntilChanged()
    );
  }

  /**
   * Update pressure data from weather API
   */
  public updatePressure(
    pressure: number,
    temperature?: number,
    humidity?: number,
    windSpeed?: number
  ): void {
    // Add to pressure history
    const now = Date.now();
    this.pressureHistory.push({ pressure, timestamp: now });

    // Clean old history
    this.pressureHistory = this.pressureHistory.filter(
      (entry) => now - entry.timestamp < this.HISTORY_DURATION
    );

    // Calculate pressure trend and analysis
    const analysis = this.analyzePressure(
      pressure,
      temperature,
      humidity,
      windSpeed
    );
    this.currentAnalysis$.next(analysis);
  }

  /**
   * Analyze current pressure conditions for storm prediction
   */
  private analyzePressure(
    currentPressure: number,
    temperature?: number,
    humidity?: number,
    windSpeed?: number
  ): StormPressureAnalysis {
    // Adjust for altitude (rough approximation)
    // Pressure decreases ~12 hPa per 100m elevation, but we'll use sea level values
    const normalPressure = this.NORMAL_SEA_LEVEL_PRESSURE;

    // Calculate pressure drop intensity
    const pressureDrop = normalPressure - currentPressure;
    const maxDrop = normalPressure - this.SEVERE_STORM_THRESHOLD;
    const dropIntensity = Math.max(0, Math.min(1, pressureDrop / maxDrop));

    // Determine if storm is approaching
    const isStormApproaching = currentPressure < this.STORM_PRESSURE_THRESHOLD;

    // Calculate storm severity
    let stormSeverity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
    if (currentPressure < this.SEVERE_STORM_THRESHOLD) {
      stormSeverity = 'severe';
    } else if (currentPressure < 990) {
      stormSeverity = 'moderate';
    } else if (currentPressure < this.STORM_PRESSURE_THRESHOLD) {
      stormSeverity = 'mild';
    }

    // Calculate confidence based on additional factors
    let confidence = this.calculateConfidence(
      currentPressure,
      pressureDrop,
      temperature,
      humidity,
      windSpeed
    );

    // Factor in pressure trend from history
    const pressureTrend = this.calculatePressureTrend();
    if (pressureTrend < -2) {
      // Rapidly falling pressure
      confidence = Math.min(1, confidence + 0.3);
    }

    return {
      currentPressure,
      normalPressure,
      dropIntensity,
      isStormApproaching: isStormApproaching && dropIntensity > 0.2,
      stormSeverity,
      confidence,
    };
  }

  /**
   * Calculate confidence in storm prediction based on multiple factors
   */
  private calculateConfidence(
    pressure: number,
    pressureDrop: number,
    temperature?: number,
    humidity?: number,
    windSpeed?: number
  ): number {
    let confidence = 0;

    // Base confidence from pressure drop
    confidence += Math.min(0.6, pressureDrop / 30); // Up to 0.6 for 30 hPa drop

    // Temperature factor (storms often bring temperature changes)
    if (temperature !== undefined) {
      // Very rough heuristic - storms can bring cooler air
      const tempFactor = Math.max(0, (25 - temperature) / 25); // Cooler = higher confidence
      confidence += tempFactor * 0.15;
    }

    // Humidity factor (high humidity can indicate storm conditions)
    if (humidity !== undefined && humidity > 70) {
      confidence += Math.min(0.15, ((humidity - 70) / 30) * 0.15);
    }

    // Wind speed factor (increasing winds can indicate approaching weather)
    if (windSpeed !== undefined && windSpeed > 5) {
      confidence += Math.min(0.1, ((windSpeed - 5) / 15) * 0.1);
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate pressure trend from recent history
   * Returns pressure change in hPa per hour
   */
  private calculatePressureTrend(): number {
    if (this.pressureHistory.length < 2) {
      return 0;
    }

    // Look at pressure change over last hour
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentReadings = this.pressureHistory.filter(
      (entry) => entry.timestamp > oneHourAgo
    );

    if (recentReadings.length < 2) {
      return 0;
    }

    // Simple linear trend calculation
    const oldest = recentReadings[0];
    const newest = recentReadings[recentReadings.length - 1];
    const timeDiff = newest.timestamp - oldest.timestamp;
    const pressureDiff = newest.pressure - oldest.pressure;

    // Convert to hPa per hour
    return (pressureDiff / timeDiff) * (60 * 60 * 1000);
  }

  /**
   * Get human-readable pressure interpretation
   */
  public getPressureDescription(): Observable<string> {
    return this.currentAnalysis$.pipe(
      map((analysis) => {
        if (analysis.stormSeverity === 'severe') {
          return 'Severe low pressure - major storm conditions';
        } else if (analysis.stormSeverity === 'moderate') {
          return 'Moderate low pressure - storm likely';
        } else if (analysis.stormSeverity === 'mild') {
          return 'Low pressure - unsettled weather';
        } else if (analysis.currentPressure > 1020) {
          return 'High pressure - clear weather likely';
        } else {
          return 'Normal pressure conditions';
        }
      })
    );
  }

  /**
   * Reset pressure history (useful for testing)
   */
  public resetHistory(): void {
    this.pressureHistory = [];
    this.currentAnalysis$.next({
      currentPressure: this.NORMAL_SEA_LEVEL_PRESSURE,
      normalPressure: this.NORMAL_SEA_LEVEL_PRESSURE,
      dropIntensity: 0,
      isStormApproaching: false,
      stormSeverity: 'none',
      confidence: 0,
    });
  }
}
