import {
  Directive,
  Input,
  HostListener,
  ElementRef,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text: string = '';
  private tooltipEl: HTMLElement | null = null;
  private hideTimeout: any = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('mouseover', ['$event'])
  onMouseOver(event: MouseEvent) {
    if (!this.text) return;
    if (this.tooltipEl) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
      return;
    }
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.textContent = this.text;
    Object.assign(this.tooltipEl.style, {
      position: 'fixed',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '0.5rem 0.75rem',
      borderRadius: '0.25rem',
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      zIndex: '10000',
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    } as CSSStyleDeclaration);
    document.body.appendChild(this.tooltipEl);
    const rect = this.el.nativeElement.getBoundingClientRect();
    const left = rect.right + 8;
    const top = rect.top + rect.height / 2;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.transform = 'translateY(-50%)';
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
    this.hideTimeout = setTimeout(() => this.destroyTooltip(), 100);
  }

  ngOnDestroy() {
    this.destroyTooltip();
  }

  private destroyTooltip() {
    if (this.tooltipEl) {
      document.body.removeChild(this.tooltipEl);
      this.tooltipEl = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}
