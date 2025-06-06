import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      [class]="'material-symbols-' + variant + ' icon ' + size"
      [style.color]="color"
      [attr.aria-label]="ariaLabel"
      [attr.title]="ariaLabel"
    >
      <ng-content *ngIf="!icon"></ng-content>
      {{ icon }}
    </span>
  `,
  styleUrls: ['./icon.component.scss'],
})
export class IconComponent {
  @Input() icon: string = '';
  @Input() variant: 'outlined' | 'sharp' = 'outlined';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() color?: string;
  @Input() ariaLabel?: string;
}
