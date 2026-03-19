// src/app/components/ui/input.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  forwardRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type InputType = 'text' | 'number' | 'textarea';
export type InputSize = 'small' | 'medium' | 'large';
export type InputAppearance = 'default' | 'modal';
export type InputValue = string | number;

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="input-wrapper" [class]="size + ' ' + appearance">
      <label *ngIf="label" [for]="inputId" class="input-label">
        {{ label }}
      </label>

      <textarea
        *ngIf="type === 'textarea'"
        #inputElement
        [id]="inputId"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [rows]="rows"
        [value]="value"
        [attr.autocomplete]="autocomplete"
        (input)="onInput($event)"
        (focus)="onFocus($event)"
        (blur)="onBlur($event)"
        (keydown)="onKeydown($event)"
        class="input-field textarea"
      ></textarea>

      <input
        *ngIf="type !== 'textarea'"
        #inputElement
        [type]="type"
        [id]="inputId"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [value]="value"
        [attr.autocomplete]="autocomplete"
        (input)="onInput($event)"
        (focus)="onFocus($event)"
        (blur)="onBlur($event)"
        (keydown)="onKeydown($event)"
        class="input-field"
      />
    </div>
  `,
  styleUrls: ['./input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements OnInit, ControlValueAccessor {
  @Input() type: InputType = 'text';
  @Input() label: string = '';
  @Input() placeholder: string = '';
  @Input() disabled: boolean = false;
  @Input() size: InputSize = 'medium';
  @Input() appearance: InputAppearance = 'default';
  @Input() rows: number = 2; // For textarea
  @Input() autocomplete: string = 'off';
  @Input() value: InputValue = ''; // Add value input

  @Output() inputChange = new EventEmitter<string>();
  @Output() focusEvent = new EventEmitter<FocusEvent>();
  @Output() blurEvent = new EventEmitter<FocusEvent>();
  @Output() keydownEvent = new EventEmitter<KeyboardEvent>();
  @Output() enterPressed = new EventEmitter<KeyboardEvent>();

  @ViewChild('inputElement') inputElementRef!: ElementRef<
    HTMLInputElement | HTMLTextAreaElement
  >;

  inputId: string = '';

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  ngOnInit() {
    this.inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
  }

  onInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.onChange(this.value);
    this.inputChange.emit(this.value);
  }

  onFocus(event: FocusEvent) {
    this.focusEvent.emit(event);
  }

  onBlur(event: FocusEvent) {
    this.onTouched();
    this.blurEvent.emit(event);
  }

  onKeydown(event: KeyboardEvent) {
    this.keydownEvent.emit(event);
    if (
      event.key === 'Enter' &&
      !(event.shiftKey || event.ctrlKey || event.metaKey)
    ) {
      // For textarea, prevent new line and emit event
      if (this.type === 'textarea') {
        event.preventDefault();
        this.enterPressed.emit(event);
      }
      // For text/number inputs, let the form handle it naturally (don't preventDefault)
      // This allows form submission to work properly
    }
  }

  // ControlValueAccessor methods
  writeValue(value: InputValue | null | undefined): void {
    this.value = value || '';
    if (this.inputElementRef) {
      this.inputElementRef.nativeElement.value = String(this.value);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Public method to focus the input
  focus(): void {
    if (this.inputElementRef) {
      this.inputElementRef.nativeElement.focus();
    }
  }

  // Public method to select all text
  select(): void {
    if (this.inputElementRef) {
      this.inputElementRef.nativeElement.select();
    }
  }

  // Public method to set the value
  setValue(value: InputValue): void {
    this.writeValue(value);
  }

  // Public method to get the current value
  getValue(): InputValue {
    return this.value;
  }
}
