import {
  Directive,
  Input,
  HostListener,
  ElementRef,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

// Global tooltip manager to ensure only one tooltip is visible at a time
class TooltipManager {
  private static instance: TooltipManager;
  private currentTooltip: HTMLElement | null = null;
  private currentDirective: TooltipDirective | null = null;

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  showTooltip(directive: TooltipDirective, tooltipEl: HTMLElement) {
    // Hide any existing tooltip immediately
    this.hideCurrentTooltip(true);

    this.currentTooltip = tooltipEl;
    this.currentDirective = directive;
  }
  hideCurrentTooltip(immediate: boolean = false) {
    if (this.currentTooltip && this.currentDirective) {
      this.currentDirective.hideTooltip(immediate);
    }
    this.currentTooltip = null;
    this.currentDirective = null;
  }

  isCurrentTooltip(directive: TooltipDirective): boolean {
    return this.currentDirective === directive;
  }
}

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy, OnChanges {
  @Input('appTooltip') text: string = '';
  @Input('tooltipPosition') position: 'top' | 'bottom' | 'left' | 'right' =
    'right';
  @Input('tooltipClass') customClass: string = '';
  private tooltipEl: HTMLElement | null = null;
  private hideTimeout: any = null;
  private tooltipManager = TooltipManager.getInstance();

  constructor(private el: ElementRef<HTMLElement>) {}
  @HostListener('mouseover', ['$event'])
  onMouseOver(event: MouseEvent) {
    if (!this.text) return;

    // Clear any pending hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // If this directive already has a tooltip showing, don't recreate it
    if (this.tooltipEl && this.tooltipManager.isCurrentTooltip(this)) {
      return;
    }

    this.createTooltip();
  }

  @HostListener('mouseout', ['$event'])
  onMouseOut(event: MouseEvent) {
    // Only destroy if the mouse truly left the host and its children
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
    // Auto position tooltips for items inside an app-tab to match its side
    const tabEl = this.el.nativeElement.closest('app-tab');
    if (tabEl) {
      const side = tabEl.getAttribute('side') as 'left' | 'right';
      this.position = side;
    }
    // Let the tooltip manager handle hiding any existing tooltips
    this.tooltipManager.hideCurrentTooltip(true);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.textContent = this.text;

    // Apply CSS classes
    this.tooltipEl.className = `app-tooltip tooltip-${this.position}`;
    if (this.customClass) {
      this.tooltipEl.classList.add(this.customClass);
    }

    document.body.appendChild(this.tooltipEl);
    this.positionTooltip();

    // Register with tooltip manager
    this.tooltipManager.showTooltip(this, this.tooltipEl);

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.tooltipEl) {
        this.tooltipEl.classList.add('tooltip-visible');
      }
    });
  }
  private positionTooltip() {
    if (!this.tooltipEl) return;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    // Get offset from CSS variable (fallback to 4px)
    const computedStyle = getComputedStyle(this.tooltipEl);
    const offsetStr = computedStyle.getPropertyValue('--tooltip-offset').trim();
    const offset = parseInt(offsetStr) || 4;

    let left = 0;
    let top = 0;

    switch (this.position) {
      case 'right':
        left = rect.right + offset;
        top = rect.top + rect.height / 2;
        break;
      case 'left':
        left = rect.left - tooltipRect.width - offset;
        top = rect.top + rect.height / 2;
        break;
      case 'top':
        left = rect.left + rect.width / 2;
        top = rect.top - tooltipRect.height - offset;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2;
        top = rect.bottom + offset;
        break;
    }

    // Keep tooltip within viewport with smaller margins
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - margin;
    }
    if (left < margin) {
      left = margin;
    }
    if (top + tooltipRect.height > viewportHeight) {
      top = viewportHeight - tooltipRect.height - margin;
    }
    if (top < margin) {
      top = margin;
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }
  ngOnDestroy() {
    this.hideTooltip();
  }
  hideTooltip(immediate: boolean = false) {
    if (this.tooltipEl) {
      if (immediate) {
        // Immediate destruction for tooltip switching
        if (this.tooltipEl.parentNode) {
          document.body.removeChild(this.tooltipEl);
        }
        this.tooltipEl = null;
      } else {
        // Animated destruction for normal hiding
        this.tooltipEl.classList.remove('tooltip-visible');
        setTimeout(() => {
          if (this.tooltipEl && this.tooltipEl.parentNode) {
            document.body.removeChild(this.tooltipEl);
          }
          this.tooltipEl = null;
        }, 200); // Wait for animation to complete
      }
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
  ngOnChanges(changes: SimpleChanges) {
    // Update tooltip immediately when the bound text changes
    if (changes['text'] && this.tooltipEl) {
      this.tooltipEl.textContent = this.text;
      this.positionTooltip();
    }
  }
}
