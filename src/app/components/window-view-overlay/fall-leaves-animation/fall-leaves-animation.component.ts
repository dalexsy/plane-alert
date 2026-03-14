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

/**
 * Individual falling leaf for autumn animation
 */
export interface FallLeaf {
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
  /** Horizontal sway range */
  swayRange: number;
  /** Animation progress (0-1) */
  progress: number;
  /** Fall speed modifier */
  speed: number;
  /** Size scale factor */
  scale: number;
  /** Current scale (for fade out shrinking) */
  currentScale: number;
  /** Animation delays in seconds */
  fallDelay: number;
  swayDelay: number;
  rotateDelay: number;
  /** Leaf color type - limited to 3 autumn colors */
  colorType: 'red' | 'orange' | 'brown';
  /** Opacity for fade in/out */
  opacity: number;
}

/**
 * Configuration for fall leaves animation
 */
export interface FallLeavesConfig {
  /** Number of leaves to animate */
  leafCount: number;
  /** Base fall speed */
  baseSpeed: number;
  /** Speed variation factor */
  speedVariation: number;
  /** Size variation factor */
  sizeVariation: number;
  /** Animation duration in milliseconds */
  duration: number;
  /** Delay between leaf spawns */
  spawnDelay: number;
  /** Overall animation intensity */
  intensity: number;
}

@Component({
  selector: 'app-fall-leaves-animation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fall-leaves-animation.component.html',
  styleUrls: ['./fall-leaves-animation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallLeavesAnimationComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input() isAutumn: boolean = true; // True for fall/spring season
  @Input() animationsEnabled: boolean = true;
  @Input() windSpeed: number = 0; // Wind speed in m/s
  @Input() windStat: number = 0; // Wind intensity level 0-3

  private readonly defaultConfig: FallLeavesConfig = {
    leafCount: 15,
    baseSpeed: 0.03, // Much slower base speed
    speedVariation: 0.3,
    sizeVariation: 0.4,
    duration: 25000, // 25 seconds
    spawnDelay: 1600, // Slower spawning
    intensity: 1.0,
  };

  private leavesArray: FallLeaf[] = [];
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  private spawnTimer: number | null = null;
  public isActive = false;
  public isSpringPetals = false; // Cherry blossom mode for spring

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateSeasonalMode();
    if (this.animationsEnabled && this.isAutumn && this.isHighWind()) {
      this.startAnimation();
    }
  }

  ngOnChanges(): void {
    this.updateSeasonalMode();
    if (
      this.isAutumn &&
      this.animationsEnabled &&
      this.isHighWind() &&
      !this.isActive
    ) {
      this.startAnimation();
    } else if (
      (!this.isAutumn || !this.animationsEnabled || !this.isHighWind()) &&
      this.isActive
    ) {
      this.stopAnimation();
    }

    // Update animation speed when windspeed changes
    if (this.isActive) {
      this.updateLeafSpeeds();
    }
  }

  /**
   * Determine if we should show cherry blossom petals (spring) or fall leaves
   */
  private updateSeasonalMode(): void {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    // Spring mode: March (3) through June (6)
    this.isSpringPetals = month >= 3 && month <= 6;
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  /**
   * Check if wind conditions are suitable for leaf display (high wind)
   */
  private isHighWind(): boolean {
    return this.windStat >= 3; // Strong winds (>= 6 m/s)
  }

  /**
   * Get current leaves array for template
   */
  public get leaves(): FallLeaf[] {
    return this.leavesArray;
  }

  /**
   * Start the fall leaves animation
   */
  private startAnimation(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.leavesArray = [];

    const config = this.defaultConfig;
    this.scheduleLeafSpawning(config);
    this.startAnimationLoop();
  }

  /**
   * Stop the animation
   */
  private stopAnimation(): void {
    this.isActive = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    this.fadeOutLeaves();
  }

  /**
   * Schedule leaf spawning with delays
   */
  private scheduleLeafSpawning(config: FallLeavesConfig): void {
    let spawnedCount = 0;

    const spawnNext = () => {
      if (!this.isActive || spawnedCount >= config.leafCount) {
        return;
      }

      this.spawnLeaf(config);
      spawnedCount++;

      if (spawnedCount < config.leafCount) {
        const delay =
          config.spawnDelay + (Math.random() - 0.5) * config.spawnDelay * 0.5;
        this.spawnTimer = window.setTimeout(spawnNext, delay);
      }
    };

    spawnNext();
  }

  /**
   * Spawn a single leaf
   */
  private spawnLeaf(config: FallLeavesConfig): void {
    const leaf: FallLeaf = {
      id: `leaf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startX: Math.random() * 120 - 10, // Start slightly off-screen
      startY: -10, // Start above the view
      x: 0,
      y: 0,
      swayRange: 5 + Math.random() * 10, // Much smaller horizontal sway distance
      progress: 0,
      speed: this.calculateLeafSpeed(config.baseSpeed),
      scale: 0.6 + Math.random() * 0.8,
      currentScale: 1, // Start at full size
      fallDelay: Math.random() * 2,
      swayDelay: Math.random() * 3,
      rotateDelay: Math.random() * 4,
      colorType: this.getRandomLeafColor(),
      opacity: 0,
    };

    // Set initial position
    leaf.x = leaf.startX;
    leaf.y = leaf.startY;

    this.leavesArray.push(leaf);
    this.cdr.markForCheck();
  }

  /**
   * Calculate leaf speed based on windspeed
   */
  private calculateLeafSpeed(baseSpeed: number): number {
    // Base speed is slower, windspeed adds variation
    // Wind speed of 0 = very slow falling (0.01-0.02)
    // Wind speed of 5 m/s = moderate speed (0.02-0.04)
    // Wind speed of 10+ m/s = faster falling (0.04-0.06)
    const windFactor = Math.min(this.windSpeed / 10, 1); // Normalize to 0-1
    const minSpeed = 0.01 + windFactor * 0.02;
    const maxSpeed = 0.02 + windFactor * 0.04;
    return minSpeed + Math.random() * (maxSpeed - minSpeed);
  }

  /**
   * Update speeds of existing leaves when windspeed changes
   */
  private updateLeafSpeeds(): void {
    this.leavesArray.forEach((leaf) => {
      leaf.speed = this.calculateLeafSpeed(0.08); // Use a base speed for recalculation
    });
  }

  /**
   * Get random leaf color - limited to 3 autumn colors
   */
  private getRandomLeafColor(): 'red' | 'orange' | 'brown' {
    const colors: ('red' | 'orange' | 'brown')[] = ['red', 'orange', 'brown'];
    return colors[Math.floor(Math.random() * colors.length)];
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
      this.updateLeaves(deltaTime);
      this.lastUpdateTime = currentTime;

      this.cdr.markForCheck();
      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Update all leaf positions and states
   */
  private updateLeaves(deltaTime: number): void {
    const updatedLeaves: FallLeaf[] = [];

    for (const leaf of this.leavesArray) {
      leaf.progress += leaf.speed * (deltaTime / 1000);

      if (leaf.progress >= 1.0) {
        // Reset leaf for continuous falling
        this.resetLeafForNewCycle(leaf);
      }

      // Update position
      this.updateLeafPosition(leaf);

      // Fade in/out and scale
      if (leaf.progress < 0.1) {
        // Fade in
        leaf.opacity = leaf.progress * 10;
        leaf.currentScale = 0.5 + leaf.progress * 5; // Scale from 0.5 to 1.0
      } else if (leaf.progress > 0.9) {
        // Fade out and shrink
        const fadeProgress = (leaf.progress - 0.9) / 0.1; // 0 to 1 over last 10%
        leaf.opacity = (1 - fadeProgress) * 10;
        leaf.currentScale = Math.max(0.3, 1 - fadeProgress * 0.7); // Scale from 1.0 to 0.3
      } else {
        // Full opacity and size
        leaf.opacity = 1;
        leaf.currentScale = 1;
      }

      updatedLeaves.push(leaf);
    }

    this.leavesArray = updatedLeaves;
  }

  /**
   * Reset a leaf to start a new fall cycle
   */
  private resetLeafForNewCycle(leaf: FallLeaf): void {
    leaf.progress = 0;
    leaf.startX = Math.random() * 120 - 10;
    leaf.startY = -10;
    leaf.swayRange = 20 + Math.random() * 30;
    leaf.speed = leaf.speed * (0.8 + Math.random() * 0.4);
    leaf.fallDelay = Math.random() * 2;
    leaf.swayDelay = Math.random() * 3;
    leaf.rotateDelay = Math.random() * 4;
    leaf.colorType = this.getRandomLeafColor();
    leaf.currentScale = 1; // Reset to full size
  }

  /**
   * Update leaf position with falling and swaying motion
   */
  private updateLeafPosition(leaf: FallLeaf): void {
    const t = leaf.progress;

    // Vertical movement (falling down)
    leaf.y = leaf.startY + t * 100; // Fall from -10% to 90%

    // Horizontal movement (swaying in wind)
    const swayOffset =
      Math.sin(t * Math.PI * 2 + leaf.swayDelay) * leaf.swayRange;
    leaf.x = leaf.startX + swayOffset;
  }

  /**
   * Fade out existing leaves
   */
  private fadeOutLeaves(): void {
    // Fade out existing leaves
    const fadeInterval = setInterval(() => {
      this.leavesArray = this.leavesArray
        .map((leaf) => ({
          ...leaf,
          opacity: Math.max(0, leaf.opacity - 0.1),
        }))
        .filter((leaf) => leaf.opacity > 0);

      this.cdr.markForCheck();

      if (this.leavesArray.length === 0) {
        clearInterval(fadeInterval);
      }
    }, 50);
  }

  /**
   * Get leaf position styles
   */
  public getLeafPosition(leaf: FallLeaf): { [key: string]: string } {
    return {
      left: `${leaf.x}%`,
      top: `${leaf.y}%`,
      opacity: leaf.opacity.toString(),
      '--dynamic-scale': leaf.currentScale.toString(),
    };
  }

  /**
   * Get size class for leaf
   */
  public getLeafSizeClass(leaf: FallLeaf): string {
    if (leaf.scale < 0.7) return 'small';
    if (leaf.scale > 1.0) return 'large';
    return 'medium';
  }

  /**
   * Track by function for ngFor optimization
   */
  public trackByLeafId(index: number, leaf: FallLeaf): string {
    return leaf.id;
  }
}
