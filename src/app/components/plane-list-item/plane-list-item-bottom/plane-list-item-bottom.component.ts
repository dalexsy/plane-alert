import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectorRef,
  ElementRef,
  Renderer2,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../ui/button/button.component';
import { PlaneFilterService } from '../../../services/plane-filter.service';
import { OperatorTooltipService } from '../../../services/operator-tooltip.service';
import {
  AircraftImageService,
  AircraftImage,
} from '../../../services/aircraft-image.service';
import { OperatorSymbolConfig } from '../../../config/operator-symbols.config';
import type { PlaneLogEntry } from '../../../types/plane-log-entry';

@Component({
  selector: 'app-plane-list-item-bottom',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './plane-list-item-bottom.component.html',
  styleUrls: ['./plane-list-item-bottom.component.scss'],
})
export class PlaneListItemBottomComponent implements OnChanges {
  @Input({ required: true }) plane!: PlaneLogEntry;
  @Output() filterPrefix = new EventEmitter<Event>();

  aircraftImage: AircraftImage | null = null;
  showImageTooltip = false;
  isLoadingImage = false;
  tooltipPosition = { x: 0, y: 0 };
  private tooltipElement: HTMLElement | null = null;

  constructor(
    public planeFilter: PlaneFilterService,
    private operatorTooltipService: OperatorTooltipService,
    private aircraftImageService: AircraftImageService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plane'] && !changes['plane'].firstChange) {
      this.aircraftImage = null;
      this.isLoadingImage = false;
      this.showImageTooltip = false;
    }
  }

  get operatorSymbolConfig(): OperatorSymbolConfig | null {
    return this.operatorTooltipService.getSymbolConfig(this.plane) ?? null;
  }

  isGenericModel(model: string): boolean {
    return ['Helicopter', 'Unknown', 'Aircraft'].includes(model);
  }

  get bingSearchQuery(): string {
    if (!this.plane.model) return '';
    let q = `${this.plane.model} aircraft airplane`;
    if (this.plane.operator?.trim()) {
      q += ` ${this.plane.operator.split(' ')[0]}`;
    }
    q += ' -cartoon -drawing -model -toy -lego -illustration -diagram';
    return encodeURIComponent(q);
  }

  onModelMouseEnter(event: MouseEvent): void {
    if (!this.plane.model || this.isGenericModel(this.plane.model)) return;
    if (this.aircraftImage) {
      this.showImageTooltip = true;
      this.moveTooltipToBody();
      return;
    }
    if (this.isLoadingImage) return;
    const margin = 10;
    const tooltipWidth = 300;
    const tooltipHeight = 200;
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    if (x + tooltipWidth > window.innerWidth) x = event.clientX - tooltipWidth - margin;
    if (y + tooltipHeight > window.innerHeight) y = event.clientY - tooltipHeight - margin;
    this.tooltipPosition = { x: Math.max(0, x), y: Math.max(0, y) };
    this.isLoadingImage = true;
    this.showImageTooltip = true;
    this.moveTooltipToBody();
    this.aircraftImageService.getAircraftImage(this.plane.model, this.plane.operator).subscribe({
      next: (image) => {
        this.aircraftImage = image;
        this.isLoadingImage = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.aircraftImage = null;
        this.isLoadingImage = false;
        this.cdr.detectChanges();
      },
    });
  }

  onModelMouseLeave(): void {
    this.showImageTooltip = false;
    this.isLoadingImage = false;
    this.moveTooltipBack();
    this.cdr.detectChanges();
  }

  private moveTooltipToBody(): void {
    if (this.tooltipElement) return;
    const el = this.elementRef.nativeElement.querySelector('.aircraft-image-tooltip');
    if (el) {
      this.tooltipElement = el;
      this.renderer.appendChild(document.body, this.tooltipElement);
    }
  }

  private moveTooltipBack(): void {
    if (!this.tooltipElement) return;
    const modelEl = this.elementRef.nativeElement.querySelector('.model');
    if (modelEl) this.renderer.appendChild(modelEl, this.tooltipElement);
    this.tooltipElement = null;
  }
}
