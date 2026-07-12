import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  RainService,
  RainDrop,
  RainConfiguration,
} from '../../services/rain/rain.service';
import { RainDropComponent } from './rain-drop/rain-drop.component';
import {
  getDropTransform,
  getRainOverlayClasses,
  getRainStyles,
} from '../../services/rain-overlay/rain-overlay-display.util';

@Component({
  selector: 'app-rain-overlay',
  standalone: true,
  imports: [CommonModule, RainDropComponent],
  templateUrl: './rain-overlay.component.html',
  styleUrl: './rain-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RainOverlayComponent implements OnInit, OnDestroy {
  rainDrops: RainDrop[] = [];
  isRaining = false;
  configuration: RainConfiguration | null = null;
  overlayClasses: string[] = [];
  rainStyles: Record<string, string> = {};

  private destroy$ = new Subject<void>();

  constructor(
    private rainService: RainService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rainService
      .getIsRaining()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isRaining) => {
        this.isRaining = isRaining;
        this.refreshDisplay();
      });

    this.rainService
      .getRainDrops()
      .pipe(takeUntil(this.destroy$))
      .subscribe((drops) => {
        this.rainDrops = drops;
        this.cdr.markForCheck();
      });

    this.rainService
      .getConfiguration()
      .pipe(takeUntil(this.destroy$))
      .subscribe((config) => {
        this.configuration = config;
        this.refreshDisplay();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDropTransform(drop: RainDrop): string {
    return getDropTransform(drop, this.configuration);
  }

  private refreshDisplay(): void {
    this.overlayClasses = getRainOverlayClasses(this.configuration, this.isRaining);
    this.rainStyles = getRainStyles(this.configuration);
    this.cdr.markForCheck();
  }
}
