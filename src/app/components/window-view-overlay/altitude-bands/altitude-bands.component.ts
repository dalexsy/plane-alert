import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AltitudeTick {
  y: number;
  label: string;
  color: string;
  fillColor: string;
}

@Component({
  selector: 'app-altitude-bands',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './altitude-bands.component.html',
  styleUrl: './altitude-bands.component.scss',
})
export class AltitudeBandsComponent {
  @Input() altitudeTicks: AltitudeTick[] = [];
}
