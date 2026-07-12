import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="top-buttons" [ngClass]="side">
    <ng-content></ng-content>
  </div>`,
  styleUrls: ['./tab.component.scss'],
})
export class TabComponent {
  @Input() side: 'left' | 'right' = 'left';
}
