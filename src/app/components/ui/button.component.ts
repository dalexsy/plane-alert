// src/app/components/ui/button.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
} from '@angular/core';
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
export class ButtonComponent implements OnChanges {
  @Input() text: string | null = null;
  @Input() icon: string | null = null;
  @Input() ariaLabel?: string;
  @Input() nativeType: 'button' | 'submit' | 'reset' = 'button';
  @Input() type: ButtonType = 'primary';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() disabled: boolean = false;
  @Output() click = new EventEmitter<Event>();

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['icon'] &&
      this.el.nativeElement.classList.contains('shuffle-toggle')
    ) {
      // Removed debug log for shuffle-toggle icon changes
      // console.log(`[ShuffleButton] icon changed to: ${this.icon}`);
    }
  }

  onClick(event: Event) {
    // Stop event propagation FIRST to prevent any parent handlers
    event.preventDefault();
    event.stopPropagation();
    // Only emit if not disabled
    if (!this.disabled) {
      this.click.emit(event);
    }
  }
}
