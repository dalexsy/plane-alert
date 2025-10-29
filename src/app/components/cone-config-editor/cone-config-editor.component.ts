import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ViewConeConfig {
  startAngle: number;
  endAngle: number;
  label: string;
}

@Component({
  selector: 'app-cone-config-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cone-config-editor.component.html',
  styleUrl: './cone-config-editor.component.scss'
})
export class ConeConfigEditorComponent {
  @Input() cones: ViewConeConfig[] = [];
  @Output() conesChange = new EventEmitter<ViewConeConfig[]>();
  @Output() closeEditor = new EventEmitter<void>();

  addCone(): void {
    this.cones = [...this.cones, { startAngle: 0, endAngle: 90, label: 'New View' }];
    this.conesChange.emit(this.cones);
  }

  removeCone(index: number): void {
    this.cones = this.cones.filter((_, i) => i !== index);
    this.conesChange.emit(this.cones);
  }

  updateCone(index: number, cone: ViewConeConfig): void {
    this.cones = this.cones.map((c, i) => i === index ? cone : c);
    this.conesChange.emit(this.cones);
  }

  onConeChange(index: number, field: keyof ViewConeConfig, value: string | number): void {
    const updatedCone = { ...this.cones[index], [field]: value };
    this.updateCone(index, updatedCone);
  }

  trackByIndex(index: number): number {
    return index;
  }

  close(): void {
    this.closeEditor.emit();
  }
}
