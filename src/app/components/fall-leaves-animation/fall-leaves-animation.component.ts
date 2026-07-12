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
import {
  FallLeaf,
  DEFAULT_FALL_LEAVES_CONFIG,
  isHighWind,
  createFallLeaf,
  calculateLeafSpeed,
  tickLeaves,
  getLeafPositionStyles,
  getLeafSizeClass,
} from '../../services/fall-leaves/fall-leaves-animation.util';
import { FallLeafComponent } from './fall-leaf/fall-leaf.component';

export type { FallLeaf };

@Component({
  selector: 'app-fall-leaves-animation',
  standalone: true,
  imports: [CommonModule, FallLeafComponent],
  templateUrl: './fall-leaves-animation.component.html',
  styleUrl: './fall-leaves-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallLeavesAnimationComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isAutumn = true;
  @Input() animationsEnabled = true;
  @Input() windSpeed = 0;
  @Input() windStat = 0;

  leaves: FallLeaf[] = [];
  isActive = false;

  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  private spawnTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.animationsEnabled && this.isAutumn && isHighWind(this.windStat)) {
      this.startAnimation();
    }
  }

  ngOnChanges(): void {
    if (this.isAutumn && this.animationsEnabled && isHighWind(this.windStat) && !this.isActive) {
      this.startAnimation();
    } else if (
      (!this.isAutumn || !this.animationsEnabled || !isHighWind(this.windStat)) &&
      this.isActive
    ) {
      this.stopAnimation();
    }
    if (this.isActive) this.updateLeafSpeeds();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  getLeafPosition(leaf: FallLeaf): Record<string, string> {
    return getLeafPositionStyles(leaf);
  }

  getLeafSizeClass(leaf: FallLeaf): string {
    return getLeafSizeClass(leaf);
  }

  private startAnimation(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.leaves = [];
    this.scheduleSpawning();
    this.startLoop();
  }

  private stopAnimation(): void {
    this.isActive = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    this.leaves = [];
    this.cdr.markForCheck();
  }

  private scheduleSpawning(): void {
    const config = DEFAULT_FALL_LEAVES_CONFIG;
    let spawned = 0;
    const spawnNext = () => {
      if (!this.isActive || spawned >= config.leafCount) return;
      this.leaves = [...this.leaves, createFallLeaf(this.windSpeed, config)];
      spawned++;
      this.cdr.markForCheck();
      if (spawned < config.leafCount) {
        const delay = config.spawnDelay + (Math.random() - 0.5) * config.spawnDelay * 0.5;
        this.spawnTimer = setTimeout(spawnNext, delay);
      }
    };
    spawnNext();
  }

  private updateLeafSpeeds(): void {
    this.leaves.forEach((leaf) => {
      leaf.speed = calculateLeafSpeed(this.windSpeed, DEFAULT_FALL_LEAVES_CONFIG.baseSpeed);
    });
  }

  private startLoop(): void {
    this.lastUpdateTime = performance.now();
    const animate = (now: number) => {
      if (!this.isActive) return;
      const delta = now - this.lastUpdateTime;
      this.leaves = tickLeaves(this.leaves.map((l) => ({ ...l })));
      this.lastUpdateTime = now;
      this.cdr.markForCheck();
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }
}
