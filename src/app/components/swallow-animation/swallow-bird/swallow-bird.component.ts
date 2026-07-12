import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwallowBird } from '../../../services/swallow/swallow-animation.util';

@Component({
  selector: 'app-swallow-bird',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './swallow-bird.component.html',
  styleUrl: './swallow-bird.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwallowBirdComponent {
  @Input({ required: true }) swallow!: SwallowBird;
  @Input({ required: true }) positionStyles!: Record<string, string>;
  @Input({ required: true }) transform!: string;
  @Input({ required: true }) color!: string;
}
