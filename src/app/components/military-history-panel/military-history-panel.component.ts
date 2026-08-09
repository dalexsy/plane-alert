import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../ui/button/button.component';
import { InputComponent } from '../ui/input/input.component';
import { MilitaryHistoryTableComponent } from '../military-history-table/military-history-table.component';
import {
  MilitaryHistoryService,
  type MilitaryHistorySighting,
} from '../../services/military-history/military-history.service';
import { PushRegistrationService } from '../../services/push-registration/push-registration.service';
import {
  filterMilitaryHistory,
  HistorySortDirection,
  HistorySortField,
  sortMilitaryHistory,
} from '../../services/military-history/military-history-display.util';

@Component({
  selector: 'app-military-history-panel',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    InputComponent,
    MilitaryHistoryTableComponent,
  ],
  templateUrl: './military-history-panel.component.html',
  styleUrls: ['./military-history-panel.component.scss'],
})
export class MilitaryHistoryPanelComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  history: MilitaryHistorySighting[] = [];
  filteredHistory: MilitaryHistorySighting[] = [];
  loading = true;
  error: string | null = null;
  sortField: HistorySortField = 'lastSeen';
  sortDirection: HistorySortDirection = 'desc';
  searchQuery = '';

  constructor(
    private militaryHistory: MilitaryHistoryService,
    private pushRegistration: PushRegistrationService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const userKey = this.pushRegistration.getStoredUserKey();
    if (!userKey) {
      this.error =
        'No Pushover key found. Enable notifications to track history.';
      this.loading = false;
      return;
    }

    try {
      this.history = await this.militaryHistory.getHistory(userKey);
      this.applyFiltersAndSort();
    } catch (error) {
      console.error('Failed to load history:', error);
      this.error = 'Failed to load history';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onClose() {
    this.close.emit();
  }

  onSort(field: HistorySortField) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.applyFiltersAndSort();
  }

  onSearchChange(value: string) {
    this.searchQuery = value.toLowerCase();
    this.applyFiltersAndSort();
  }

  private applyFiltersAndSort() {
    const filtered = filterMilitaryHistory(this.history, this.searchQuery);
    this.filteredHistory = sortMilitaryHistory(
      filtered,
      this.sortField,
      this.sortDirection,
    );
    this.cdr.detectChanges();
  }
}