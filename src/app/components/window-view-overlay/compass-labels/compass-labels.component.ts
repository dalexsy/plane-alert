import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compass-labels',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './compass-labels.component.html',
  styleUrl: './compass-labels.component.scss',
})
export class CompassLabelsComponent {
  @Input() compassBackground: string = '#ff9753';
  @Input() chimneyBackground: string = '#8b4513'; // This will be overridden by parent
}
