import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { type AircraftImage } from '../../../services/aircraft-image/aircraft-image.service';

@Component({
  selector: 'app-aircraft-image-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="loading" class="loading-spinner">
      <span class="material-symbols-sharp">refresh</span>
      Loading image...
    </div>
    <div *ngIf="!loading && image" class="image-container">
      <img [src]="image.thumbnail" [alt]="image.description" loading="lazy" />
      <div class="image-source">{{ image.description }}</div>
    </div>
    <div *ngIf="!loading && !image" class="no-image">No image available</div>
  `,
  styleUrls: ['./aircraft-image-tooltip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'aircraft-image-tooltip',
    '[class.visible]': 'visible',
    '[class.loading]': 'loading',
    '[style.left.px]': 'position.x + offset',
    '[style.top.px]': 'position.y + offset',
    '[style.display]': 'visible ? displayMode : "none"',
    '[style.z-index]': 'zIndex',
  },
})
export class AircraftImageTooltipComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() visible = false;
  @Input() loading = false;
  @Input() image: AircraftImage | null = null;
  @Input() position = { x: 0, y: 0 };
  @Input() offset = 10;
  @Input() zIndex = 10001;

  private originalParent: Node | null = null;
  private appendedToBody = false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  get displayMode(): string {
    return this.loading ? 'flex' : 'block';
  }

  ngAfterViewInit(): void {
    this.originalParent = this.elementRef.nativeElement.parentNode;
    this.syncPortalState();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.syncPortalState();
  }

  ngOnDestroy(): void {
    this.restoreToOriginalParent();
  }

  private syncPortalState(): void {
    if (!this.originalParent) {
      return;
    }

    if (this.visible && !this.appendedToBody) {
      this.renderer.appendChild(document.body, this.elementRef.nativeElement);
      this.appendedToBody = true;
      return;
    }

    if (!this.visible && this.appendedToBody) {
      this.restoreToOriginalParent();
    }
  }

  private restoreToOriginalParent(): void {
    if (!this.originalParent || !this.appendedToBody) {
      return;
    }

    this.renderer.appendChild(
      this.originalParent,
      this.elementRef.nativeElement,
    );
    this.appendedToBody = false;
  }
}