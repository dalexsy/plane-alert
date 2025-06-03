import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sky-background',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sky-background.component.html',
  styleUrl: './sky-background.component.scss'
})
export class SkyBackgroundComponent {
  @Input() windowCloudUrl: string | null = null;
  @Input() cloudFilter: string = 'none';
  @Input() cloudBacklightClass: string = '';
}
