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
import { BehaviorSubject } from 'rxjs';
import { AltitudeColorService } from '../../services/altitude-color/altitude-color.service';
import {
  SwallowBird,
  SwallowConfig,
  calculateConfigFromPressure,
  createSwallow,
  getSwallowAltitudeColor,
  getSwallowPositionStyles,
  getSwallowTransform,
  tickSwallows,
} from '../../services/swallow/swallow-animation.util';
import { SwallowBirdComponent } from './swallow-bird/swallow-bird.component';
import { kioskDecorativeFxLockedOff } from '../../utils/kiosk-mode/kiosk-mode.util';

export type { SwallowBird, SwallowConfig };

@Component({
  selector: 'app-swallow-animation',
  standalone: true,
  imports: [CommonModule, SwallowBirdComponent],
  templateUrl: './swallow-animation.component.html',
  styleUrl: './swallow-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwallowAnimationComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isStormApproaching = false;
  @Input() pressureIntensity = 0;
  @Input() animationsEnabled = true;

  private swallows$ = new BehaviorSubject<SwallowBird[]>([]);
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  private spawnTimer: ReturnType<typeof setTimeout> | null = null;
  isActive = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private altitudeColorService: AltitudeColorService
  ) {}

  get swallows(): SwallowBird[] {
    return this.swallows$.value;
  }

  ngOnInit(): void {
    if (this.canRunDecorative()) this.startAnimation();
  }

  ngOnChanges(): void {
    if (this.isStormApproaching && this.canRunDecorative() && !this.isActive) {
      this.startAnimation();
    } else if ((!this.isStormApproaching || !this.canRunDecorative()) && this.isActive) {
      this.stopAnimation();
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  private canRunDecorative(): boolean {
    return this.animationsEnabled && !kioskDecorativeFxLockedOff();
  }

  startAnimation(): void {
    if (this.isActive || kioskDecorativeFxLockedOff()) return;
    this.isActive = true;
    this.swallows$.next([]);
    this.scheduleSpawning(calculateConfigFromPressure());
    this.startLoop();
  }

  stopAnimation(): void {
    this.isActive = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    this.swallows$.next([]);
    this.cdr.markForCheck();
  }

  getSwallowPosition(swallow: SwallowBird): Record<string, string> {
    return getSwallowPositionStyles(swallow);
  }

  getSwallowTransform(swallow: SwallowBird): string {
    return getSwallowTransform(swallow);
  }

  getSwallowColor(swallow: SwallowBird): string {
    return getSwallowAltitudeColor(swallow, (alt) =>
      this.altitudeColorService.getFillColor(alt)
    );
  }

  private scheduleSpawning(config: SwallowConfig): void {
    let spawned = 0;
    const spawnNext = () => {
      if (!this.isActive || spawned >= config.birdCount) return;
      this.swallows$.next([...this.swallows$.value, createSwallow(config)]);
      spawned++;
      this.cdr.markForCheck();
      if (spawned < config.birdCount) {
        const delay = config.spawnDelay + (Math.random() - 0.5) * config.spawnDelay * 0.5;
        this.spawnTimer = setTimeout(spawnNext, delay);
      }
    };
    spawnNext();
  }

  private startLoop(): void {
    this.lastUpdateTime = performance.now();
    const animate = (now: number) => {
      if (!this.isActive) return;
      const delta = now - this.lastUpdateTime;
      this.swallows$.next(tickSwallows([...this.swallows$.value], delta));
      this.lastUpdateTime = now;
      this.cdr.markForCheck();
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }
}
