import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compass-labels',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './compass-labels.component.html',
  styleUrl: './compass-labels.component.scss'
})
export class CompassLabelsComponent {
  @Input() compassBackground: string = '#ff9753';
}
