import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperatorCallSignService } from '../../services/operator-call-sign.service';
import {
  AircraftDbService,
  AircraftRecord,
} from '../../services/aircraft-db.service';

@Component({
  selector: 'app-data-management',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './data-management.component.html',
  styleUrl: './data-management.component.scss',
})
export class DataManagementComponent {
  @Output() closeEditor = new EventEmitter<void>();
  // Operator form
  operatorPrefix = '';
  operatorName = '';

  // File upload
  selectedFile: File | null = null;

  constructor(
    private operatorService: OperatorCallSignService,
    private aircraftService: AircraftDbService
  ) {}

  addOperator(): void {
    if (this.operatorPrefix && this.operatorName) {
      this.operatorService.addMapping(this.operatorPrefix, this.operatorName);
      this.operatorPrefix = '';
      this.operatorName = '';
      alert('Operator added successfully!');
    }
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  importData(): void {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          // Assume aircraft records
          this.aircraftService.importRecords(data);
          alert('Aircraft data imported successfully!');
        } else if (typeof data === 'object') {
          // Assume operator mappings
          this.operatorService.importMappings(data);
          alert('Operator data imported successfully!');
        }
      } catch (error) {
        alert('Error parsing JSON file: ' + error);
      }
    };
    reader.readAsText(this.selectedFile);
  }

  getUserOperators(): Record<string, string> {
    return this.operatorService.getUserMappings();
  }

  getUserAircraft(): AircraftRecord[] {
    return this.aircraftService.getUserRecords();
  }

  removeOperator(prefix: string): void {
    this.operatorService.removeMapping(prefix);
  }

  removeAircraft(icao: string): void {
    this.aircraftService.removeRecord(icao);
  }

  getDatabaseStats(): { mainDb: number; userDb: number; total: number } {
    return this.aircraftService.getDatabaseStats();
  }

  close(): void {
    this.closeEditor.emit();
  }
}
