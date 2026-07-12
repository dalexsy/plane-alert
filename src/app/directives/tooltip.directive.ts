import {
  Directive,
  Input,
  HostListener,
  ElementRef,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { TooltipManager, positionTooltipElement } from './tooltip-manager';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy, OnChanges {
  @Input('appTooltip') text: string = '';
  @Input('tooltipPosition') position: 'top' | 'bottom' | 'left' | 'right' =
    'right';
  @Input('tooltipVariant') variant: 'default' | 'left-side' = 'default';
  @Input('tooltipClass') customClass: string = '';
  private tooltipEl: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private tooltipManager = TooltipManager.getInstance();

  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('mouseover', ['$event'])
  onMouseOver(_event: MouseEvent) {
    if (!this.text) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.tooltipEl && this.tooltipManager.isCurrentTooltip(this)) {
      return;
    }

    this.createTooltip();
  }

  @HostListener('mouseout', ['$event'])
  onMouseOut(event: MouseEvent) {
    if (!this.tooltipEl) return;
    if (
      event.relatedTarget &&
      this.el.nativeElement.contains(event.relatedTarget as Node)
    ) {
      return;
    }
    this.hideTimeout = setTimeout(() => this.hideTooltip(), 100);
  }

  private createTooltip() {
    const explicitPos = this.el.nativeElement.getAttribute('tooltipPosition');
    if (!explicitPos) {
      const tabEl = this.el.nativeElement.closest('app-tab');
      if (tabEl) {
        const side = tabEl.getAttribute('side') as 'left' | 'right';
        this.position = side === 'left' ? 'right' : 'left';
      }
    }

    if (this.variant === 'left-side') {
      this.position = 'left';
    }

    this.tooltipManager.hideCurrentTooltip(true);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.textContent = this.text;
    this.tooltipEl.className = `app-tooltip tooltip-${this.position}`;
    if (this.customClass) {
      this.tooltipEl.classList.add(this.customClass);
    }
    if (this.variant === 'left-side') {
      this.tooltipEl.classList.add('tooltip-left-variant');
    }

    document.body.appendChild(this.tooltipEl);
    this.positionTooltip();
    this.tooltipManager.showTooltip(this, this.tooltipEl);

    requestAnimationFrame(() => {
      if (this.tooltipEl) {
        this.tooltipEl.classList.add('tooltip-visible');
        requestAnimationFrame(() => {
          this.positionTooltip();
        });
      }
    });
  }

  private positionTooltip() {
    if (!this.tooltipEl) return;
    positionTooltipElement(this.tooltipEl, this.el.nativeElement, this.position);
  }

  ngOnDestroy() {
    this.hideTooltip();
  }

  hideTooltip(immediate: boolean = false) {
    if (this.tooltipEl) {
      if (immediate) {
        if (this.tooltipEl.parentNode) {
          document.body.removeChild(this.tooltipEl);
        }
        this.tooltipEl = null;
      } else {
        this.tooltipEl.classList.remove('tooltip-visible');
        setTimeout(() => {
          if (this.tooltipEl && this.tooltipEl.parentNode) {
            document.body.removeChild(this.tooltipEl);
          }
          this.tooltipEl = null;
        }, 200);
      }
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['text'] && this.tooltipEl) {
      this.tooltipEl.textContent = this.text;
      this.positionTooltip();
    }
  }
}
