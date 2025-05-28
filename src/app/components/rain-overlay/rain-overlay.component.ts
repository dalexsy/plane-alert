import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, takeUntil } from 'rxjs';
import { RainService, RainDrop, RainConfiguration } from '../../services/rain.service';

@Component({
  selector: 'app-rain-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="rain-overlay"
      [class.active]="isRaining"
      [style.opacity]="isRaining ? 1 : 0"
    >
      <div
        *ngFor="let drop of rainDrops; trackBy: trackByDropId"
        class="rain-drop"
        [style.left.%]="drop.x"
        [style.top.%]="drop.y"
        [style.transform]="getDropTransform(drop)"
        [style.opacity]="drop.opacity"
        [style.animation-delay.ms]="drop.delay"
        [style.animation-duration.ms]="drop.duration"
      ></div>
    </div>
  `,
  styles: [
    `
      .rain-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 5; /* Above other overlays but below UI elements */
        overflow: hidden;
        transition: opacity 0.5s ease-in-out;
      }      .rain-drop {
        position: absolute;
        width: 2px;
        height: 12px;
        background: linear-gradient(
          to bottom,
          rgba(200, 220, 255, 0.2) 0%,
          rgba(200, 220, 255, 0.6) 50%,
          rgba(200, 220, 255, 0.9) 100%
        );
        border-radius: 0 0 50% 50%;
        pointer-events: none;
        filter: blur(0.5px);
        box-shadow: 0 0 1px rgba(200, 220, 255, 0.3);
        animation: fall linear infinite;
        transform-origin: center bottom;
      }

      .rain-drop::before {
        content: '';
        position: absolute;
        top: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 1px;
        height: 4px;
        background: rgba(200, 220, 255, 0.8);
        border-radius: 50%;
      }

      /* Heavy rain drops (larger) */
      .rain-overlay.heavy .rain-drop {
        width: 3px;
        height: 16px;
        filter: blur(0.3px);
      }

      /* Light rain drops (smaller) */
      .rain-overlay.light .rain-drop {
        width: 1px;
        height: 8px;
        filter: blur(0.8px);
      }

      /* Wind effect classes */
      .rain-overlay.wind-left .rain-drop {
        transform: skewX(-15deg);
      }

      .rain-overlay.wind-right .rain-drop {
        transform: skewX(15deg);
      }

      .rain-overlay.wind-strong .rain-drop {
        animation-name: fall-windy;
      }

      @keyframes fall {
        0% {
          transform: translateY(-20px) scale(1);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translateY(calc(100vh + 50px)) scale(0.8);
          opacity: 0;
        }
      }

      @keyframes fall-windy {
        0% {
          transform: translateY(-20px) translateX(0) scale(1);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        50% {
          transform: translateY(50vh) translateX(10px) scale(0.9);
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translateY(calc(100vh + 50px)) translateX(20px) scale(0.8);
          opacity: 0;
        }
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .rain-drop {
          width: 1.5px;
          height: 10px;
        }
      }

      /* Performance optimizations */
      .rain-overlay {
        will-change: opacity;
      }

      .rain-drop {
        will-change: transform, opacity;
        backface-visibility: hidden;
        perspective: 1000px;
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .rain-drop {
          animation-duration: 1s !important;
          opacity: 0.3 !important;
        }
        
        .rain-overlay {
          transition: none;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {        .rain-drop {
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.2) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0.9) 100%
          );
          box-shadow: 0 0 1px rgba(255, 255, 255, 0.5);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RainOverlayComponent implements OnInit, OnDestroy {
  public rainDrops: RainDrop[] = [];
  public isRaining = false;
  public configuration: RainConfiguration | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private rainService: RainService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to rain state
    this.rainService
      .getIsRaining()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isRaining: boolean) => {
        this.isRaining = isRaining;
        this.cdr.markForCheck();
      });

    // Subscribe to rain drops
    this.rainService
      .getRainDrops()
      .pipe(takeUntil(this.destroy$))
      .subscribe((drops: RainDrop[]) => {
        this.rainDrops = drops;
        this.cdr.markForCheck();
      });

    // Subscribe to configuration changes
    this.rainService
      .getConfiguration()
      .pipe(takeUntil(this.destroy$))
      .subscribe((config: RainConfiguration) => {
        this.configuration = config;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Track function for rain drops to optimize rendering
   */
  public trackByDropId(index: number, drop: RainDrop): string {
    return drop.id;
  }

  /**
   * Get transform string for individual rain drop
   */
  public getDropTransform(drop: RainDrop): string {
    const config = this.configuration;
    if (!config) return `scale(${drop.size})`;

    const windSkew = config.windAngle * 0.3; // Convert wind angle to skew
    const scale = drop.size;

    return `scale(${scale}) skewX(${windSkew}deg)`;
  }

  /**
   * Get CSS classes for rain overlay based on current configuration
   */
  public getRainOverlayClasses(): string[] {
    const classes: string[] = [];
    const config = this.configuration;

    if (!config || !this.isRaining) {
      return classes;
    }

    // Intensity classes
    if (config.intensity > 0.8) {
      classes.push('heavy');
    } else if (config.intensity < 0.4) {
      classes.push('light');
    }

    // Wind effect classes
    if (Math.abs(config.windAngle) > 15) {
      classes.push('wind-strong');
    }

    if (config.windAngle > 10) {
      classes.push('wind-right');
    } else if (config.windAngle < -10) {
      classes.push('wind-left');
    }

    return classes;
  }

  /**
   * Get dynamic CSS variables for rain styling
   */
  public getRainStyles(): { [key: string]: string } {
    const config = this.configuration;
    if (!config) return {};

    return {
      '--rain-color': config.color,
      '--rain-opacity': config.opacity.toString(),
      '--fall-speed': `${config.fallSpeed}ms`,
    };
  }
}
