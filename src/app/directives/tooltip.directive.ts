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
  @Input('tooltipVariant') variant: 'default' | 'left-side' = 'default';
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
    // Auto position based on app-tab side only when no explicit tooltipPosition attribute
    const explicitPos = this.el.nativeElement.getAttribute('tooltipPosition');
    if (!explicitPos) {
      const tabEl = this.el.nativeElement.closest('app-tab');
      if (tabEl) {
        const side = tabEl.getAttribute('side') as 'left' | 'right';
        // Show tooltips outward: if tab is on left, position on right; if tab is on right, position on left
        this.position = side === 'left' ? 'right' : 'left';
      }
    }

    // Override position for left-side variant
    if (this.variant === 'left-side') {
      this.position = 'left';
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
    if (this.variant === 'left-side') {
      this.tooltipEl.classList.add('tooltip-left-variant');
    }

    document.body.appendChild(this.tooltipEl);
    this.positionTooltip();

    // Register with tooltip manager
    this.tooltipManager.showTooltip(this, this.tooltipEl);

    // Trigger animation and reposition after layout
    requestAnimationFrame(() => {
      if (this.tooltipEl) {
        this.tooltipEl.classList.add('tooltip-visible');
        // Reposition after the tooltip is visible and has its final size
        requestAnimationFrame(() => {
          this.positionTooltip();
        });
      }
    });
  }
  private positionTooltip() {
    if (!this.tooltipEl) return;

    const rect = this.el.nativeElement.getBoundingClientRect();

    // Get actual tooltip dimensions
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const actualTooltipWidth = Math.max(tooltipRect.width || 0, 50); // Minimum width with fallback
    const actualTooltipHeight = Math.max(tooltipRect.height || 0, 20); // Minimum height with fallback

    // Get offset from CSS variable (fallback to 12px)
    const computedStyle = getComputedStyle(this.tooltipEl);
    const offsetStr = computedStyle.getPropertyValue('--tooltip-offset').trim();
    const offset = parseInt(offsetStr) || 12;

    let left = 0;
    let top = 0;

    switch (this.position) {
      case 'right':
        left = rect.right + offset;
        top = rect.top + rect.height / 2 - actualTooltipHeight / 2; // Center vertically on button
        break;
      case 'left':
        left = rect.left - actualTooltipWidth - offset;
        top = rect.top + rect.height / 2 - actualTooltipHeight / 2; // Center vertically on button
        break;
      case 'top':
        left = rect.left + rect.width / 2 - actualTooltipWidth / 2;
        top = rect.top - actualTooltipHeight - offset;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - actualTooltipWidth / 2;
        top = rect.bottom + offset;
        break;
    }

    // Keep tooltip within viewport with smaller margins
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    // Adjust horizontal position if tooltip would go off-screen
    if (left < margin) {
      left = margin;
    } else if (left + actualTooltipWidth > viewportWidth - margin) {
      left = viewportWidth - actualTooltipWidth - margin;
    }

    // Adjust vertical position if tooltip would go off-screen
    if (top < margin) {
      top = margin;
    } else if (top + actualTooltipHeight > viewportHeight - margin) {
      top = viewportHeight - actualTooltipHeight - margin;
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
