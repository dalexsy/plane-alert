import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Configuration interface for rain animation parameters
 */
export interface RainConfiguration {
  /** Number of rain drops to render */
  dropCount: number;
  /** Rain intensity (0.0 to 1.0) */
  intensity: number;
  /** Wind effect on rain angle (-45 to 45 degrees) */
  windAngle: number;
  /** Base drop fall speed in pixels per second */
  fallSpeed: number;
  /** Drop size variance (0.5 to 2.0) */
  sizeVariance: number;
  /** Rain opacity (0.0 to 1.0) */
  opacity: number;
  /** Drop color */
  color: string;
}

/**
 * Individual rain drop data structure
 */
export interface RainDrop {
  /** Unique identifier for the drop */
  id: string;
  /** X position as percentage (0-100) */
  x: number;
  /** Y position as percentage (0-100) */
  y: number;
  /** Drop size scale factor */
  size: number;
  /** Fall speed multiplier */
  speed: number;
  /** Drop opacity (0.0 to 1.0) */
  opacity: number;
  /** Animation delay in milliseconds */
  delay: number;
  /** Animation duration in milliseconds */
  duration: number;
}

/**
 * Weather-based rain intensity mapping
 */
export interface WeatherRainMapping {
  /** Light drizzle */
  drizzle: number;
  /** Light rain */
  lightRain: number;
  /** Moderate rain */
  moderateRain: number;
  /** Heavy rain */
  heavyRain: number;
  /** Thunderstorm */
  thunderstorm: number;
}

/**
 * Enhanced rain animation service with atmospheric physics
 * 
 * FEATURES:
 * - Real-time weather data integration from OpenWeatherMap API
 * - Atmospheric condition-based rain intensity calculation  
 * - Dynamic fall speed based on air density (pressure/temperature)
 * - Humidity-influenced drop count and size variance
 * - Visibility-based precipitation density
 * - Temperature-dependent rain color shifts
 * - Wind-affected rain angle with realistic physics
 * - Pressure-influenced drop formation characteristics
 * 
 * ATMOSPHERIC PHYSICS:
 * - Air density affects terminal velocity of raindrops
 * - Humidity influences drop formation and size distribution
 * - Pressure variations affect drop compression and behavior
 * - Temperature controls moisture capacity and drop characteristics
 * - Visibility correlates with precipitation density and particle size
 * 
 * WEATHER CONDITIONS SUPPORTED:
 * - Drizzle, Light Rain, Moderate Rain, Heavy Rain, Thunderstorms
 * - Dynamic intensity scaling based on weather descriptions
 * - Realistic color variations for different conditions
 * - Atmospheric modifier calculations for enhanced realism
 */
@Injectable({
  providedIn: 'root',
})
export class RainService {
  private readonly defaultConfig: RainConfiguration = {
    dropCount: 150,
    intensity: 0.7,
    windAngle: 0,
    fallSpeed: 800,
    sizeVariance: 1.2,
    opacity: 0.6,
    color: 'rgba(200, 220, 255, 0.8)',
  };

  private readonly weatherIntensityMap: WeatherRainMapping = {
    drizzle: 0.3,
    lightRain: 0.5,
    moderateRain: 0.7,
    heavyRain: 0.9,
    thunderstorm: 1.0,
  };

  private currentConfig$ = new BehaviorSubject<RainConfiguration>(
    this.defaultConfig
  );
  private rainDrops$ = new BehaviorSubject<RainDrop[]>([]);
  private isRaining$ = new BehaviorSubject<boolean>(false);

  private animationFrameId: number | null = null;
  private lastUpdateTime = 0;

  constructor() {
    this.initializeRainDrops();
  }

  /**
   * Get current rain configuration
   */
  public getConfiguration(): Observable<RainConfiguration> {
    return this.currentConfig$.asObservable();
  }

  /**
   * Get current rain drops array
   */
  public getRainDrops(): Observable<RainDrop[]> {
    return this.rainDrops$.asObservable();
  }

  /**
   * Check if rain animation is active
   */
  public getIsRaining(): Observable<boolean> {
    return this.isRaining$.asObservable();
  }
  /**
   * Update rain based on weather conditions and atmospheric data
   * @param weatherCondition Main weather condition
   * @param weatherDescription Detailed weather description
   * @param windSpeed Wind speed in m/s
   * @param windDirection Wind direction in degrees
   * @param humidity Humidity percentage (0-100)
   * @param pressure Atmospheric pressure in hPa
   * @param temperature Temperature in Kelvin
   * @param visibility Visibility in meters
   */
  public updateWeatherConditions(
    weatherCondition: string | null,
    weatherDescription: string | null,
    windSpeed: number = 0,
    windDirection: number = 0,
    humidity: number = 50,
    pressure: number = 1013.25,
    temperature: number = 288.15,
    visibility: number = 10000
  ): void {    const condition = weatherCondition?.toLowerCase() || '';
    const description = weatherDescription?.toLowerCase() || '';

    // Determine if it should be raining
    const shouldRain = this.shouldActivateRain(condition, description);    if (shouldRain) {
      const intensity = this.calculateRainIntensity(condition, description, humidity, pressure, temperature);
      const windAngle = this.calculateWindEffect(windSpeed, windDirection);
      const fallSpeed = this.calculateFallSpeed(intensity, pressure, temperature, humidity);
      const dropCount = this.calculateDropCount(intensity, visibility, humidity);
      const rainColor = this.calculateRainColor(condition, description, temperature, visibility);
      const sizeVariance = this.calculateSizeVariance(intensity, pressure, humidity);

      this.startRain({
        ...this.defaultConfig,
        intensity,
        windAngle,
        fallSpeed,
        dropCount,
        color: rainColor,
        sizeVariance,
        opacity: Math.max(0.3, this.defaultConfig.opacity * intensity),
      });
    } else {
      this.stopRain();
    }
  }

  /**
   * Manually start rain with custom configuration
   * @param config Rain configuration parameters
   */
  public startRain(config?: Partial<RainConfiguration>): void {
    const newConfig = { ...this.defaultConfig, ...config };
    this.currentConfig$.next(newConfig);
    this.isRaining$.next(true);

    this.generateRainDrops(newConfig);
    this.startAnimation();
  }

  /**
   * Stop rain animation
   */
  public stopRain(): void {
    this.isRaining$.next(false);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Gradually fade out existing drops
    this.fadeOutRainDrops();
  }

  /**
   * Update rain configuration without restarting animation
   * @param config Partial configuration to update
   */
  public updateConfiguration(config: Partial<RainConfiguration>): void {
    if (!this.isRaining$.value) return;

    const currentConfig = this.currentConfig$.value;
    const newConfig = { ...currentConfig, ...config };
    this.currentConfig$.next(newConfig);

    // Regenerate drops if drop count changed significantly
    if (Math.abs(newConfig.dropCount - currentConfig.dropCount) > 20) {
      this.generateRainDrops(newConfig);
    }
  }
  /**
   * Get rain intensity for specific weather description
   * @param description Weather description
   * @returns Intensity value (0.0 to 1.0)
   */
  public getIntensityForDescription(description: string): number {
    return this.calculateRainIntensity('rain', description, 50, 1013.25, 288.15);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopRain();
    this.currentConfig$.complete();
    this.rainDrops$.complete();
    this.isRaining$.complete();
  }

  /**
   * Determine if rain should be activated based on weather conditions
   */
  private shouldActivateRain(
    condition: string,
    description: string
  ): boolean {
    return (
      condition.includes('rain') ||
      condition.includes('drizzle') ||
      condition.includes('thunderstorm') ||
      description.includes('rain') ||
      description.includes('drizzle') ||
      description.includes('shower')
    );
  }
  /**
   * Calculate rain intensity based on weather conditions and atmospheric data
   */
  private calculateRainIntensity(
    condition: string,
    description: string,
    humidity: number = 50,
    pressure: number = 1013.25,
    temperature: number = 288.15  ): number {
    // Base intensity from weather description
    let baseIntensity = this.weatherIntensityMap.moderateRain;

    // Check for specific intensity keywords in description
    if (description.includes('heavy') || description.includes('extreme')) {
      baseIntensity = this.weatherIntensityMap.heavyRain;
    } else if (description.includes('moderate')) {
      baseIntensity = this.weatherIntensityMap.moderateRain;
    } else if (description.includes('light') || description.includes('slight')) {
      baseIntensity = this.weatherIntensityMap.lightRain;
    } else if (description.includes('drizzle')) {
      baseIntensity = this.weatherIntensityMap.drizzle;
    }

    // Check main condition
    if (condition.includes('thunderstorm')) {
      baseIntensity = Math.max(baseIntensity, this.weatherIntensityMap.thunderstorm);
    } else if (condition.includes('drizzle')) {
      baseIntensity = Math.min(baseIntensity, this.weatherIntensityMap.drizzle);
    }

    // Apply atmospheric modifiers
    let intensityModifier = 1.0;

    // Humidity effect: Higher humidity increases perceived intensity
    const humidityFactor = Math.max(0.7, Math.min(1.3, humidity / 70));
    intensityModifier *= humidityFactor;

    // Pressure effect: Lower pressure often means more intense precipitation
    const normalPressure = 1013.25;
    const pressureFactor = Math.max(0.8, Math.min(1.2, normalPressure / pressure));
    intensityModifier *= pressureFactor;

    // Temperature effect: Warmer air can hold more moisture
    const tempCelsius = temperature - 273.15;
    const tempFactor = tempCelsius > 15 ? 
      Math.min(1.15, 1 + (tempCelsius - 15) * 0.01) : 
      Math.max(0.85, 1 - (15 - tempCelsius) * 0.005);
    intensityModifier *= tempFactor;

    return Math.max(0.1, Math.min(1.0, baseIntensity * intensityModifier));
  }

  /**
   * Calculate wind effect on rain angle
   */
  private calculateWindEffect(windSpeed: number, windDirection: number): number {
    // Convert wind speed to angle effect (0-45 degrees)
    const maxWindAngle = 45;
    const maxWindSpeed = 15; // m/s for maximum effect

    const windEffect = Math.min(windSpeed / maxWindSpeed, 1.0);
    const baseAngle = windEffect * maxWindAngle;

    // Adjust angle based on wind direction (simplified)
    // Wind from left (270°) creates positive angle (rain slants right)
    // Wind from right (90°) creates negative angle (rain slants left)
    const normalizedDirection = ((windDirection + 180) % 360) - 180;
    const directionFactor = Math.sin((normalizedDirection * Math.PI) / 180);

    return baseAngle * directionFactor;
  }

  /**
   * Calculate realistic fall speed based on atmospheric conditions
   */
  private calculateFallSpeed(
    intensity: number,
    pressure: number,
    temperature: number,
    humidity: number
  ): number {
    // Base fall speed from configuration
    let fallSpeed = this.defaultConfig.fallSpeed;

    // Intensity effect: Higher intensity = larger drops = faster fall
    const intensityFactor = 0.7 + (intensity * 0.6); // 0.7 to 1.3 multiplier
    fallSpeed *= intensityFactor;

    // Air density effect (from pressure and temperature)
    const normalPressure = 1013.25; // hPa
    const normalTemp = 288.15; // Kelvin (15°C)
    
    // Air density is proportional to pressure/temperature
    const airDensityRatio = (pressure / normalPressure) * (normalTemp / temperature);
    const densityFactor = Math.max(0.8, Math.min(1.2, 2 - airDensityRatio));
    fallSpeed *= densityFactor;

    // Humidity effect: Higher humidity = slightly slower fall due to air resistance
    const humidityFactor = Math.max(0.95, 1 - (humidity - 50) * 0.002);
    fallSpeed *= humidityFactor;

    return Math.max(400, Math.min(1200, fallSpeed));
  }

  /**
   * Calculate drop count based on atmospheric conditions and visibility
   */
  private calculateDropCount(
    intensity: number,
    visibility: number,
    humidity: number
  ): number {
    // Base drop count from configuration
    let dropCount = this.defaultConfig.dropCount;

    // Intensity effect: More intense rain = more drops
    const intensityFactor = 0.5 + (intensity * 1.0); // 0.5 to 1.5 multiplier
    dropCount *= intensityFactor;

    // Visibility effect: Lower visibility often means denser precipitation
    const visibilityKm = Math.max(0.1, visibility / 1000);
    const visibilityFactor = visibilityKm > 10 ? 1.0 : 
      Math.max(0.8, Math.min(1.4, 1 + (10 - visibilityKm) * 0.06));
    dropCount *= visibilityFactor;

    // Humidity effect: Higher humidity can support more drops
    const humidityFactor = Math.max(0.8, Math.min(1.2, humidity / 75));
    dropCount *= humidityFactor;

    return Math.round(Math.max(50, Math.min(300, dropCount)));
  }

  /**
   * Calculate size variance based on atmospheric conditions
   */
  private calculateSizeVariance(
    intensity: number,
    pressure: number,
    humidity: number
  ): number {
    // Base size variance from configuration
    let sizeVariance = this.defaultConfig.sizeVariance;

    // Intensity effect: Higher intensity = more size variation
    const intensityFactor = 0.8 + (intensity * 0.8); // 0.8 to 1.6 multiplier
    sizeVariance *= intensityFactor;

    // Pressure effect: Lower pressure = larger drops due to less compression
    const normalPressure = 1013.25;
    const pressureFactor = Math.max(0.9, Math.min(1.3, normalPressure / pressure));
    sizeVariance *= pressureFactor;

    // Humidity effect: Higher humidity = slightly larger drops
    const humidityFactor = Math.max(0.95, Math.min(1.15, humidity / 75));
    sizeVariance *= humidityFactor;

    return Math.max(0.8, Math.min(2.5, sizeVariance));
  }

  /**
   * Generate rain drops based on configuration
   */
  private generateRainDrops(config: RainConfiguration): void {
    const drops: RainDrop[] = [];

    for (let i = 0; i < config.dropCount; i++) {
      drops.push(this.createRainDrop(i.toString(), config));
    }

    this.rainDrops$.next(drops);
  }

  /**
   * Create a single rain drop
   */
  private createRainDrop(id: string, config: RainConfiguration): RainDrop {
    // Random position across full width + some overflow for wind effect
    const x = Math.random() * 120 - 10; // -10% to 110% for wind offset

    // Start above viewport
    const y = -Math.random() * 20 - 5; // -25% to -5%

    // Size variation
    const size = 0.5 + Math.random() * (config.sizeVariance - 0.5);

    // Speed variation (±20%)
    const speed = 0.8 + Math.random() * 0.4;

    // Opacity variation
    const opacity = Math.max(0.1, config.opacity + (Math.random() - 0.5) * 0.3);

    // Animation timing
    const delay = Math.random() * 2000; // 0-2 second delay
    const baseDuration = 3000; // 3 seconds base
    const duration = baseDuration / speed;

    return {
      id,
      x,
      y,
      size,
      speed,
      opacity,
      delay,
      duration,
    };
  }

  /**
   * Initialize default rain drops
   */
  private initializeRainDrops(): void {
    this.generateRainDrops(this.defaultConfig);
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.lastUpdateTime = Date.now();
    this.animate();
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isRaining$.value) return;

    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    this.updateRainDropPositions(deltaTime);
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update rain drop positions
   */
  private updateRainDropPositions(deltaTime: number): void {
    const config = this.currentConfig$.value;
    const drops = this.rainDrops$.value;

    const updatedDrops = drops.map((drop) => {
      // Calculate fall distance based on time
      const fallDistance = (config.fallSpeed * drop.speed * deltaTime) / 1000;
      const fallPercentage = (fallDistance / window.innerHeight) * 100;

      // Apply wind effect
      const windEffect = (config.windAngle / 45) * 0.5; // Max 0.5% horizontal movement per frame
      const newX = drop.x + windEffect;
      const newY = drop.y + fallPercentage;

      // Reset drop if it has fallen off screen
      if (newY > 105) {
        return this.createRainDrop(drop.id, config);
      }

      return {
        ...drop,
        x: newX,
        y: newY,
      };
    });

    this.rainDrops$.next(updatedDrops);
  }

  /**
   * Gradually fade out rain drops
   */
  private fadeOutRainDrops(): void {
    const drops = this.rainDrops$.value;
    const fadedDrops = drops.map((drop) => ({
      ...drop,
      opacity: drop.opacity * 0.9,
    }));

    this.rainDrops$.next(fadedDrops);

    // Continue fading until all drops are very transparent
    if (fadedDrops.some((drop) => drop.opacity > 0.05)) {
      setTimeout(() => this.fadeOutRainDrops(), 100);
    } else {
      this.rainDrops$.next([]);
    }
  }

  /**
   * Calculate rain drop color based on weather conditions and atmospheric data
   */
  private calculateRainColor(
    condition: string,
    description: string,
    temperature: number,
    visibility: number
  ): string {
    // Base rain color
    let baseColor = { r: 200, g: 220, b: 255, a: 0.8 }; // Light blue

    // Temperature effects
    const tempCelsius = temperature - 273.15;
    if (tempCelsius < 5) {
      // Cold rain - more grayish
      baseColor.r = Math.max(150, baseColor.r - 30);
      baseColor.g = Math.max(180, baseColor.g - 20);
      baseColor.b = Math.max(200, baseColor.b - 10);
    } else if (tempCelsius > 25) {
      // Warm rain - more transparent, slightly warmer tone
      baseColor.a = Math.max(0.6, baseColor.a - 0.1);
      baseColor.g = Math.min(255, baseColor.g + 15);
    }

    // Weather condition effects
    if (condition.includes('thunderstorm')) {
      // Thunderstorm rain - darker, more intense
      baseColor.r = Math.max(120, baseColor.r - 50);
      baseColor.g = Math.max(140, baseColor.g - 50);
      baseColor.b = Math.max(180, baseColor.b - 40);
      baseColor.a = Math.min(0.95, baseColor.a + 0.2);
    } else if (description.includes('heavy')) {
      // Heavy rain - more opaque and slightly darker
      baseColor.r = Math.max(170, baseColor.r - 20);
      baseColor.g = Math.max(190, baseColor.g - 20);
      baseColor.a = Math.min(0.9, baseColor.a + 0.1);
    } else if (description.includes('drizzle') || description.includes('light')) {
      // Light rain/drizzle - more transparent
      baseColor.a = Math.max(0.4, baseColor.a - 0.3);
    }

    // Visibility effects
    if (visibility < 5000) {
      // Low visibility - darker, more opaque rain
      baseColor.r = Math.max(150, baseColor.r - 30);
      baseColor.g = Math.max(170, baseColor.g - 30);
      baseColor.b = Math.max(200, baseColor.b - 30);
      baseColor.a = Math.min(0.95, baseColor.a + 0.15);
    }

    return `rgba(${Math.round(baseColor.r)}, ${Math.round(baseColor.g)}, ${Math.round(baseColor.b)}, ${baseColor.a})`;
  }
}
