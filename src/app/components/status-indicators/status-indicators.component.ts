import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-status-indicators',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  template: `
    <div class="status-indicators">
      <!-- Animations off notification: clickable to re-enable, dismissible -->
      <div
        class="status-item clickable"
        *ngIf="!animationsEnabled && !animationsDismissed"
        [attr.aria-label]="'Click to enable animations'"
      >
        <span
          class="status-body"
          (click)="onToggleAnimations()"
          [appTooltip]="'Click to enable animations'"
        >
          <span class="material-symbols-sharp">motion_play</span>
          <span class="status-text">Animations off</span>
        </span>
        <button
          class="dismiss-btn"
          (click)="onDismissAnimations()"
          [appTooltip]="'Dismiss notification'"
          aria-label="Dismiss"
        >
          <span class="material-symbols-sharp">close</span>
        </button>
      </div>

      <!-- Animations enabled confirmation: shows for 3s with undo -->
      <div
        class="status-item clickable success"
        *ngIf="showAnimationsEnabled"
        [class.fading]="animationsEnabledFading"
      >
        <span class="status-body non-interactive">
          <span class="material-symbols-sharp">motion_photos_paused</span>
          <span class="status-text">Animations enabled</span>
        </span>
        <button
          class="dismiss-btn"
          (click)="onUndoAnimations()"
          [appTooltip]="'Undo'"
          aria-label="Undo"
        >
          <span class="material-symbols-sharp">undo</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./status-indicators.component.scss'],
})
export class StatusIndicatorsComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() animationsEnabled = true;
  @Output() toggleAnimations = new EventEmitter<void>();

  animationsDismissed = false;
  showAnimationsEnabled = false;
  animationsEnabledFading = false;
  private animationsDismissalKey = 'plane-alert:animations-notification-dismissed';
  private animationsEnabledTimeout?: number;
  private fadeTimeout?: number;

  nextUpdate = 0;
  private intervalId?: number;

  ngOnInit() {
    this.loadDismissalState();
  }

  ngOnChanges(changes: SimpleChanges) {
    // When animations are turned back on, show confirmation
    if (changes['animationsEnabled']) {
      const prev = changes['animationsEnabled'].previousValue;
      const curr = changes['animationsEnabled'].currentValue;
      
      if (prev === false && curr === true) {
        this.clearAnimationsDismissal();
        this.showAnimationsEnabledConfirmation();
      }
    }
  }

  ngOnDestroy() {
    if (this.animationsEnabledTimeout != null) {
      clearTimeout(this.animationsEnabledTimeout);
    }
    if (this.fadeTimeout != null) {
      clearTimeout(this.fadeTimeout);
    }
  }

  /** Load dismissal state from localStorage */
  private loadDismissalState() {
    const animDismissed = localStorage.getItem(this.animationsDismissalKey);
    this.animationsDismissed = animDismissed === 'true';
  }

  /** Toggle animations back on */
  onToggleAnimations() {
    this.toggleAnimations.emit();
  }

  /** Undo animation toggle (turn back off) */
  onUndoAnimations() {
    // Clear the confirmation timeout
    if (this.animationsEnabledTimeout != null) {
      clearTimeout(this.animationsEnabledTimeout);
    }
    if (this.fadeTimeout != null) {
      clearTimeout(this.fadeTimeout);
    }
    this.showAnimationsEnabled = false;
    this.animationsEnabledFading = false;
    
    // Toggle back off
    this.toggleAnimations.emit();
  }

  /** Show animations enabled confirmation for 3 seconds */
  private showAnimationsEnabledConfirmation() {
    this.showAnimationsEnabled = true;
    this.animationsEnabledFading = false;
    
    // Start fade after 2.5 seconds
    this.fadeTimeout = window.setTimeout(() => {
      this.animationsEnabledFading = true;
    }, 2500);
    
    // Hide after 3 seconds
    this.animationsEnabledTimeout = window.setTimeout(() => {
      this.showAnimationsEnabled = false;
      this.animationsEnabledFading = false;
    }, 3000);
  }

  /** Dismiss the animations-off notification */
  onDismissAnimations() {
    this.animationsDismissed = true;
    localStorage.setItem(this.animationsDismissalKey, 'true');
  }

  /** Clear animations dismissal state (when animations are re-enabled) */
  private clearAnimationsDismissal() {
    this.animationsDismissed = false;
    localStorage.removeItem(this.animationsDismissalKey);
  }
}
