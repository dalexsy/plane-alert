import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, BehaviorSubject, Subscription, interval } from 'rxjs';

/**
 * Individual swallow bird for storm pressure animation
 */
export interface SwallowBird {
  /** Unique identifier */
  id: string;
  /** Starting X position as percentage (0-100) */
  startX: number;
  /** Starting Y position as percentage (0-100) */
  startY: number;
  /** Current X position as percentage */
  x: number;
  /** Current Y position as percentage */
  y: number;
  /** Flight path control points for curved movement */
  controlX1: number;
  controlY1: number;
  controlX2: number;
  controlY2: number;
  /** Target end position */
  endX: number;
  endY: number;
  /** Animation progress (0-1) */
  progress: number;
  /** Flight speed modifier */
  speed: number;
  /** Size scale factor */
  scale: number;
  /** Animation delay in milliseconds */
  delay: number;
  /** Wing flap animation offset */
  flapOffset: number;
  /** Direction bird is facing (1 = right, -1 = left) */
  direction: number;
  /** Opacity for fade in/out */
  opacity: number;
}

/**
 * Configuration for swallow storm animation
 */
export interface SwallowConfig {
  /** Number of swallows to animate */
  birdCount: number;
  /** Base flight speed */
  baseSpeed: number;
  /** Speed variation factor */
  speedVariation: number;
  /** Size variation factor */
  sizeVariation: number;
  /** Animation duration in milliseconds */
  duration: number;
  /** Delay between bird spawns */
  spawnDelay: number;
  /** Overall animation intensity */
  intensity: number;
}

@Component({
  selector: 'app-swallow-animation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './swallow-animation.component.html',
  styleUrls: ['./swallow-animation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwallowAnimationComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isStormApproaching: boolean = false;
  @Input() pressureIntensity: number = 0; // 0-1 scale based on how low pressure is

  private readonly defaultConfig: SwallowConfig = {
    birdCount: 12,
    baseSpeed: 0.1,
    speedVariation: 0.4,
    sizeVariation: 0.3,
    duration: 8000,
    spawnDelay: 400,
    intensity: 1.0,
  };
  private swallows$ = new BehaviorSubject<SwallowBird[]>([]);
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  private spawnTimer: number | null = null;
  public isActive = false;
  private subscriptions: Subscription[] = [];

  constructor(private cdr: ChangeDetectorRef) {}
  ngOnInit(): void {
    console.log(
      'SwallowAnimationComponent ngOnInit - isStormApproaching:',
      this.isStormApproaching,
      'pressureIntensity:',
      this.pressureIntensity
    );
    // Force start animation for testing (remove conditions)
    console.log('Force starting animation for testing...');
    this.startAnimation();
  }
  ngOnChanges(): void {
    console.log(
      'SwallowAnimationComponent ngOnChanges - isStormApproaching:',
      this.isStormApproaching,
      'pressureIntensity:',
      this.pressureIntensity,
      'isActive:',
      this.isActive
    );
    // React to changes in storm approaching state
    if (this.isStormApproaching && !this.isActive) {
      this.startAnimation();
    } else if (!this.isStormApproaching && this.isActive) {
      this.stopAnimation();
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Get observable of current swallows
   */
  public getSwallows(): Observable<SwallowBird[]> {
    return this.swallows$.asObservable();
  }

  /**
   * Get current swallows array for template
   */
  public get swallows(): SwallowBird[] {
    return this.swallows$.value;
  }

  /**
   * Start the swallow storm animation
   */ public startAnimation(): void {
    console.log(
      'SwallowAnimationComponent startAnimation called - isActive:',
      this.isActive
    );
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.swallows$.next([]);

    // Configure animation intensity based on pressure
    const config = this.calculateConfigFromPressure();
    console.log('Swallow animation config:', config);

    this.scheduleSwallowSpawning(config);
    this.startAnimationLoop();
  }

  /**
   * Stop the animation
   */
  public stopAnimation(): void {
    this.isActive = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    // Fade out existing swallows
    this.fadeOutSwallows();
  }

  /**
   * Calculate animation configuration based on atmospheric pressure intensity
   */ private calculateConfigFromPressure(): SwallowConfig {
    const config = { ...this.defaultConfig }; // Use fixed values for testing instead of pressure intensity
    config.intensity = 1.0;
    config.birdCount = 8; // Fewer birds for testing the loop
    config.baseSpeed = 0.3; // Much slower speed for more natural movement
    config.spawnDelay = 1200; // Even longer delay between birds
    config.duration = 8000; // Fixed duration

    console.log('Using fixed config for testing:', config);
    return config;
  }

  /**
   * Schedule swallow spawning with delays
   */
  private scheduleSwallowSpawning(config: SwallowConfig): void {
    let spawnedCount = 0;

    const spawnNext = () => {
      if (!this.isActive || spawnedCount >= config.birdCount) {
        return;
      }

      this.spawnSwallow(config);
      spawnedCount++;

      if (spawnedCount < config.birdCount) {
        const delay =
          config.spawnDelay + (Math.random() - 0.5) * config.spawnDelay * 0.5;
        this.spawnTimer = window.setTimeout(spawnNext, delay);
      }
    };

    spawnNext();
  }

  /**
   * Spawn a single swallow bird
   */ private spawnSwallow(config: SwallowConfig): void {
    const swallow: SwallowBird = {
      id: `swallow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startX: -5, // Start just off-screen left for seamless loop
      startY: 10 + Math.random() * 80, // Random Y between 10% and 90% of the strip height
      x: 0,
      y: 0,
      controlX1: 30,
      controlY1: 10 + Math.random() * 80, // Match Y range for horizontal strip
      controlX2: 70,
      controlY2: 10 + Math.random() * 80, // Match Y range for horizontal strip
      endX: 105, // End just off-screen right
      endY: 10 + Math.random() * 80, // Match Y range for horizontal strip
      progress: 0,
      speed: config.baseSpeed * (0.8 + Math.random() * 0.4),
      scale: 0.8 + Math.random() * 0.4,
      delay: 0,
      flapOffset: Math.random() * Math.PI * 2,
      direction: 1, // Flying right
      opacity: 0,
    };

    // Set initial position
    swallow.x = swallow.startX;
    swallow.y = swallow.startY;

    const currentSwallows = this.swallows$.value;

    this.swallows$.next([...currentSwallows, swallow]);
    this.cdr.markForCheck(); // Force change detection
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    this.lastUpdateTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.isActive) {
        return;
      }

      const deltaTime = currentTime - this.lastUpdateTime;
      this.updateSwallows(deltaTime);
      this.lastUpdateTime = currentTime;

      this.cdr.markForCheck();
      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }
  /**
   * Update all swallow positions and states
   */
  private updateSwallows(deltaTime: number): void {
    const currentSwallows = this.swallows$.value;
    const updatedSwallows: SwallowBird[] = [];
    for (const swallow of currentSwallows) {
      // Simple, direct speed control - higher = faster, lower = slower
      const simpleSpeed = 0.00002; // Adjust this single value to control speed
      swallow.progress += simpleSpeed * deltaTime;

      // Update position using Bezier curve
      const t = Math.min(swallow.progress, 1);
      this.updateSwallowPosition(swallow, t);

      // Check if swallow has completed its path
      if (swallow.progress >= 1.0) {
        // Reset swallow to start a new cycle with slight variations
        this.resetSwallowForNewCycle(swallow);
      }

      // Always keep swallow visible (no fade out)
      swallow.opacity = 1;

      // Keep all swallows (they now loop continuously)
      updatedSwallows.push(swallow);
    }

    this.swallows$.next(updatedSwallows);
  }

  /**
   * Reset a swallow to start a new flight cycle with variations
   */
  private resetSwallowForNewCycle(swallow: SwallowBird): void {
    // Reset progress
    swallow.progress = 0;

    // Add slight variations to create more natural flocking behavior
    swallow.startX = -5 + Math.random() * 5; // Vary start position slightly
    swallow.startY = 10 + Math.random() * 80; // New random Y position
    swallow.endX = 105 + Math.random() * 5; // Vary end position slightly
    swallow.endY = 10 + Math.random() * 80; // New random end Y position

    // Vary the flight path control points for different curves
    swallow.controlX1 = 25 + Math.random() * 10; // 25-35%
    swallow.controlY1 = 10 + Math.random() * 80;
    swallow.controlX2 = 65 + Math.random() * 10; // 65-75%
    swallow.controlY2 = 10 + Math.random() * 80;

    // Slightly vary speed to create natural separation
    swallow.speed = swallow.speed * (0.9 + Math.random() * 0.2);

    // Set initial position
    swallow.x = swallow.startX;
    swallow.y = swallow.startY;

    console.log(
      'Reset swallow for new cycle:',
      swallow.id,
      'new path Y:',
      Math.round(swallow.startY),
      '->',
      Math.round(swallow.endY)
    );
  }

  /**
   * Update swallow position using cubic Bezier curve for natural flight path
   */
  private updateSwallowPosition(swallow: SwallowBird, t: number): void {
    // Cubic Bezier curve calculation
    const invT = 1 - t;
    const invT2 = invT * invT;
    const invT3 = invT2 * invT;
    const t2 = t * t;
    const t3 = t2 * t;

    swallow.x =
      invT3 * swallow.startX +
      3 * invT2 * t * swallow.controlX1 +
      3 * invT * t2 * swallow.controlX2 +
      t3 * swallow.endX;

    swallow.y =
      invT3 * swallow.startY +
      3 * invT2 * t * swallow.controlY1 +
      3 * invT * t2 * swallow.controlY2 +
      t3 * swallow.endY;
  }

  /**
   * Fade out existing swallows
   */
  private fadeOutSwallows(): void {
    const currentSwallows = this.swallows$.value;

    // Start fade out animation
    const fadeInterval = setInterval(() => {
      const updatedSwallows = currentSwallows
        .map((swallow) => ({
          ...swallow,
          opacity: Math.max(0, swallow.opacity - 0.1),
        }))
        .filter((swallow) => swallow.opacity > 0);

      this.swallows$.next(updatedSwallows);
      this.cdr.markForCheck();

      if (updatedSwallows.length === 0) {
        clearInterval(fadeInterval);
      }
    }, 50);
  }

  /**
   * Get CSS transform for swallow positioning
   */ public getSwallowTransform(swallow: SwallowBird): string {
    // Use absolute positioning instead of percentage translate
    return `scale(${swallow.scale})`;
  }

  /**
   * Get swallow position styles
   */
  public getSwallowPosition(swallow: SwallowBird): { [key: string]: string } {
    return {
      left: `${swallow.x}%`,
      top: `${swallow.y}%`,
      opacity: swallow.opacity.toString(),
    };
  }
  /**
   * Get wing flap animation style
   */
  public getWingStyle(swallow: SwallowBird): { [key: string]: string } {
    const flapSpeed = 8; // Flaps per second
    const flapCycle =
      (performance.now() * 0.001 * flapSpeed + swallow.flapOffset) %
      (Math.PI * 2);
    const flapScale = 0.8 + Math.sin(flapCycle) * 0.2; // Wing scale variation

    return {
      transform: `scaleY(${flapScale})`,
      opacity: swallow.opacity.toString(),
    };
  }

  /**
   * Track by function for ngFor optimization
   */
  public trackBySwallowId(index: number, swallow: SwallowBird): string {
    return swallow.id;
  }
}
