import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WindowViewPlane } from '../../types/window-view-plane';

@Component({
  selector: 'app-sun-sky-gradient',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sun-sky-gradient.component.html',
  styleUrls: ['./sun-sky-gradient.component.scss'],
})
export class SunSkyGradientComponent {
  @Input() sun: WindowViewPlane | undefined;
  @Input() isDaytime = false;
  @Input() sunElevationAngle = 0;
  @Input() bottomPosition = '0%';
}
