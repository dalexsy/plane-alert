import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DimSegment {
  left: number;
  width: number;
}

@Component({
  selector: 'app-dim-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dim-overlay.component.html',
  styleUrl: './dim-overlay.component.scss',
})
export class DimOverlayComponent {
  @Input() dimSegments: DimSegment[] = [];
}
