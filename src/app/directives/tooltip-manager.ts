export interface TooltipHost {
  hideTooltip(immediate?: boolean): void;
}

export class TooltipManager {
  private static instance: TooltipManager;
  private currentTooltip: HTMLElement | null = null;
  private currentDirective: TooltipHost | null = null;

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  showTooltip(directive: TooltipHost, tooltipEl: HTMLElement): void {
    this.hideCurrentTooltip(true);
    this.currentTooltip = tooltipEl;
    this.currentDirective = directive;
  }

  hideCurrentTooltip(immediate: boolean = false): void {
    if (this.currentTooltip && this.currentDirective) {
      this.currentDirective.hideTooltip(immediate);
    }
    this.currentTooltip = null;
    this.currentDirective = null;
  }

  isCurrentTooltip(directive: TooltipHost): boolean {
    return this.currentDirective === directive;
  }
}

export function positionTooltipElement(
  tooltipEl: HTMLElement,
  hostEl: HTMLElement,
  position: 'top' | 'bottom' | 'left' | 'right',
): void {
  const rect = hostEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const actualTooltipWidth = Math.max(tooltipRect.width || 0, 50);
  const actualTooltipHeight = Math.max(tooltipRect.height || 0, 20);

  const computedStyle = getComputedStyle(tooltipEl);
  const offsetStr = computedStyle.getPropertyValue('--tooltip-offset').trim();
  const offset = parseInt(offsetStr) || 12;

  let left = 0;
  let top = 0;

  switch (position) {
    case 'right':
      left = rect.right + offset;
      top = rect.top + rect.height / 2 - actualTooltipHeight / 2;
      break;
    case 'left':
      left = rect.left - actualTooltipWidth - offset;
      top = rect.top + rect.height / 2 - actualTooltipHeight / 2;
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

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  if (left < margin) {
    left = margin;
  } else if (left + actualTooltipWidth > viewportWidth - margin) {
    left = viewportWidth - actualTooltipWidth - margin;
  }

  if (top < margin) {
    top = margin;
  } else if (top + actualTooltipHeight > viewportHeight - margin) {
    top = viewportHeight - actualTooltipHeight - margin;
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}
