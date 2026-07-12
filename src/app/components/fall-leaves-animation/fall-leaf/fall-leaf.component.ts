import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FallLeaf } from '../../../services/fall-leaves/fall-leaves-animation.util';

@Component({
  selector: 'app-fall-leaf',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fall-leaf.component.html',
  styleUrl: './fall-leaf.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallLeafComponent {
  @Input({ required: true }) leaf!: FallLeaf;
  @Input({ required: true }) positionStyles!: Record<string, string>;
  @Input({ required: true }) sizeClass!: string;
}
