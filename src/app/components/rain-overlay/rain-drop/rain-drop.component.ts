import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RainDrop } from '../../../services/rain.service';

@Component({
  selector: 'app-rain-drop',
  standalone: true,
  templateUrl: './rain-drop.component.html',
  styleUrl: './rain-drop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RainDropComponent {
  @Input({ required: true }) drop!: RainDrop;
  @Input() transform = '';
}
