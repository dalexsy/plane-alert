import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  COMMON_MILITARY_TYPES,
  MilitaryAircraftType,
  PushoverConfigState,
  isTypeIgnored,
  toggleIgnoredType,
} from '../../../services/pushover/pushover-config.util';

@Component({
  selector: 'app-pushover-type-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pushover-type-grid.component.html',
  styleUrl: './pushover-type-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PushoverTypeGridComponent {
  @Input({ required: true }) state!: PushoverConfigState;
  @Output() stateChange = new EventEmitter<void>();

  readonly commonMilitaryTypes: MilitaryAircraftType[] = COMMON_MILITARY_TYPES;

  isIgnored(code: string): boolean {
    return isTypeIgnored(this.state, code);
  }

  toggle(code: string): void {
    toggleIgnoredType(this.state, code);
    this.stateChange.emit();
  }
}
