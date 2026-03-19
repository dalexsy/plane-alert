import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AircraftImageTooltipComponent } from '../ui/aircraft-image-tooltip.component';
import { ButtonComponent } from '../ui/button.component';
import { InputComponent } from '../ui/input.component';
import { CountryService } from '../../services/country.service';
import { OperatorTooltipService } from '../../services/operator-tooltip.service';
import { OperatorSymbolConfig } from '../../config/operator-symbols.config';
import {
  AircraftImageService,
  type AircraftImage,
} from '../../services/aircraft-image.service';
import {
  MilitaryHistoryService,
  type MilitaryHistorySighting,
} from '../../services/military-history.service';
import { FirebaseMessagingService } from '../../services/firebase-messaging.service';
import { getDefaultMilitaryOperator } from '../../config/military-operators.config';

type SortField =
  | 'lastSeen'
  | 'model'
  | 'country'
  | 'operator'
  | 'sightingCount'
  | 'callsign';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-military-history-panel',
  standalone: true,
  imports: [
    AircraftImageTooltipComponent,
    CommonModule,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './military-history-panel.component.html',
  styleUrls: ['./military-history-panel.component.scss'],
})
export class MilitaryHistoryPanelComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() centerPlane = new EventEmitter<{
    icao: string;
    lat?: number;
    lon?: number;
  }>();

  history: MilitaryHistorySighting[] = [];
  filteredHistory: MilitaryHistorySighting[] = [];
  loading = true;
  error: string | null = null;

  sortField: SortField = 'lastSeen';
  sortDirection: SortDirection = 'desc';

  searchQuery = '';

  // Aircraft image tooltip
  showImageTooltip = false;
  isLoadingImage = false;
  aircraftImage: AircraftImage | null = null;
  tooltipPosition = { x: 0, y: 0 };
  private imageLoadTimeout?: number;

  constructor(
    private militaryHistory: MilitaryHistoryService,
    private firebaseMessaging: FirebaseMessagingService,
    private countryService: CountryService,
    private operatorTooltipService: OperatorTooltipService,
    private aircraftImageService: AircraftImageService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    await this.loadHistory();
  }

  async loadHistory() {
    const userKey = this.firebaseMessaging.getStoredUserKey();
    if (!userKey) {
      this.error =
        'No Pushover key found. Enable notifications to track history.';
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
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

  onSort(field: SortField) {
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

  onCenterPlane(sighting: MilitaryHistorySighting) {
    this.centerPlane.emit({
      icao: sighting.icao,
      lat: sighting.lat,
      lon: sighting.lon,
    });
  }

  private applyFiltersAndSort() {
    // Filter
    let filtered = this.history;
    if (this.searchQuery) {
      filtered = this.history.filter((s) => {
        const searchable = [
          s.icao,
          s.callsign,
          s.model,
          s.operator,
          s.country,
          s.registration,
        ]
          .filter((v) => v)
          .join(' ')
          .toLowerCase();
        return searchable.includes(this.searchQuery);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (this.sortField) {
        case 'lastSeen':
          aVal = a.lastSeen;
          bVal = b.lastSeen;
          break;
        case 'callsign':
          aVal = a.callsign || '';
          bVal = b.callsign || '';
          break;
        case 'model':
          aVal = a.model || '';
          bVal = b.model || '';
          break;
        case 'country':
          aVal = a.country || '';
          bVal = b.country || '';
          break;
        case 'operator':
          aVal = a.operator || '';
          bVal = b.operator || '';
          break;
        case 'sightingCount':
          aVal = a.sightingCount;
          bVal = b.sightingCount;
          break;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return this.sortDirection === 'asc' ? cmp : -cmp;
      } else {
        const cmp = aVal - bVal;
        return this.sortDirection === 'asc' ? cmp : -cmp;
      }
    });

    this.filteredHistory = filtered;
    this.cdr.detectChanges();
  }

  getSortIcon(field: SortField): string {
    if (this.sortField !== field) return 'unfold_more';
    return this.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getFlagHTML(country: string | undefined): string {
    return this.countryService.getFlagHTML(country || '');
  }

  getOperatorSymbol(
    sighting: MilitaryHistorySighting,
  ): OperatorSymbolConfig | null {
    return this.operatorTooltipService.getSymbolConfig({
      icao: sighting.icao,
      callsign: sighting.callsign,
      operator: sighting.operator,
      country: sighting.country,
      isMilitary: true,
    });
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();

    // Compare calendar dates, not just time difference
    const dateDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor(
      (nowDay.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Format time as 12-hour with AM/PM
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    let dateText = '';
    if (diffDays === 0) {
      dateText = `Today, ${timeStr}`;
    } else if (diffDays === 1) {
      dateText = `Yesterday, ${timeStr}`;
    } else if (diffDays < 7) {
      // Show day of week for recent dates
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      dateText = `${dayName}, ${timeStr}`;
    } else {
      // Show abbreviated month and day for older dates
      const monthDay = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      dateText = `${monthDay}, ${timeStr}`;
    }

    return dateText;
  }

  onModelMouseEnter(event: MouseEvent, sighting: MilitaryHistorySighting) {
    if (!sighting.model || this.isGenericModel(sighting.model)) {
      return;
    }

    this.tooltipPosition = { x: event.clientX, y: event.clientY };
    this.showImageTooltip = true;
    this.isLoadingImage = true;
    this.aircraftImage = null;

    // Debounce image loading
    if (this.imageLoadTimeout) {
      clearTimeout(this.imageLoadTimeout);
    }

    this.imageLoadTimeout = window.setTimeout(() => {
      this.aircraftImageService
        .getAircraftImage(sighting.model!, sighting.registration)
        .subscribe({
          next: (image) => {
            if (this.showImageTooltip) {
              this.aircraftImage = image;
              this.isLoadingImage = false;
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            console.error('Failed to load aircraft image:', error);
            this.aircraftImage = null;
            this.isLoadingImage = false;
            this.cdr.detectChanges();
          },
        });
    }, 300);
  }

  onModelMouseLeave() {
    if (this.imageLoadTimeout) {
      clearTimeout(this.imageLoadTimeout);
    }
    this.showImageTooltip = false;
    this.isLoadingImage = false;
    this.aircraftImage = null;

    this.cdr.detectChanges();
  }

  @HostListener('document:scroll', [])
  onScroll() {
    if (this.showImageTooltip) {
      this.onModelMouseLeave();
    }
  }

  isGenericModel(model: string | undefined): boolean {
    if (!model) return true;
    const generic = ['Unknown', 'Helicopter', 'Glider', 'Ultralight'];
    return generic.includes(model);
  }

  getBingSearchQuery(sighting: MilitaryHistorySighting): string {
    const model = sighting.model || '';
    const operator = this.getOperatorDisplayName(sighting);
    const parts = [model, operator, 'aircraft'].filter(Boolean).join(' ');
    return encodeURIComponent(parts);
  }

  /**
   * Get display name for operator with fallback to country-based default
   */
  getOperatorDisplayName(sighting: MilitaryHistorySighting): string {
    if (sighting.operator && sighting.operator.trim()) {
      return sighting.operator;
    }
    // Fallback to country-based military operator name
    return getDefaultMilitaryOperator(sighting.country) || '—';
  }

}
