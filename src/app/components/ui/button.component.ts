// src/app/components/ui/button.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

export type ButtonType = 'primary' | 'secondary' | 'tertiary';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button
      [class]="
        type +
        (icon ? ' icon' : '') +
        (icon && text ? ' has-text' : '') +
        ' ' +
        size
      "
      [attr.aria-label]="ariaLabel"
      [type]="nativeType"
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      <app-icon *ngIf="icon" [icon]="icon" [size]="size"></app-icon>
      <span *ngIf="text" class="text">{{ text }}</span>
    </button>
  `,
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  @Input() text: string | null = null;
  @Input() icon: string | null = null;
  @Input() ariaLabel?: string;
  @Input() nativeType: 'button' | 'submit' | 'reset' = 'button';
  @Input() type: ButtonType = 'primary';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() disabled: boolean = false;
  @Output() click = new EventEmitter<Event>();

  onClick(event?: Event) {
    // Guard against missing event
    if (event && this.nativeType !== 'submit') {
      event.preventDefault();
      event.stopPropagation();
    }
    // Emit click event if not disabled
    if (!this.disabled) {
      this.click.emit(event);
    }
  }
}
