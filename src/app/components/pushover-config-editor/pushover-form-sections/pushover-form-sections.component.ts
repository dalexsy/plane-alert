import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PushoverConfigState } from '../../../services/pushover/pushover-config.util';

@Component({
  selector: 'app-pushover-form-sections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pushover-form-sections.component.html',
  styleUrl: './pushover-form-sections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PushoverFormSectionsComponent {
  @Input({ required: true }) state!: PushoverConfigState;
  @Output() customFilterChange = new EventEmitter<void>();
  @Output() radiusChange = new EventEmitter<number>();

  onRadiusInput(value: number): void {
    this.state.radiusKm = value;
    this.radiusChange.emit(value);
  }
}
