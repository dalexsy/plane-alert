import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AircraftImageTooltipComponent } from '../ui/aircraft-image-tooltip/aircraft-image-tooltip.component';
import { CountryService } from '../../services/country/country.service';
import { OperatorTooltipService } from '../../services/operator-tooltip/operator-tooltip.service';
import { OperatorSymbolConfig } from '../../config/operator-symbols.config';
import { AircraftImageService } from '../../services/aircraft-image/aircraft-image.service';
import type { MilitaryHistorySighting } from '../../services/military-history/military-history.service';
import { MilitaryHistoryImageTooltip } from '../../services/military-history/military-history-image.util';
import {
  formatHistoryDate,
  getBingSearchQuery,
  getNotificationSourceLabel,
  getOperatorDisplayName,
  HistorySortField,
  isGenericHistoryModel,
} from '../../services/military-history/military-history-display.util';

@Component({
  selector: 'app-military-history-table',
  standalone: true,
  imports: [CommonModule, AircraftImageTooltipComponent],
  templateUrl: './military-history-table.component.html',
  styleUrls: ['./military-history-table.component.scss'],
})
export class MilitaryHistoryTableComponent {
  @Input() rows: MilitaryHistorySighting[] = [];
  @Input() searchQuery = '';
  @Input() sortField: HistorySortField = 'lastSeen';
  @Input() sortDirection: 'asc' | 'desc' = 'desc';
  @Output() sortChange = new EventEmitter<HistorySortField>();

  readonly formatDate = formatHistoryDate;
  readonly getBingSearchQuery = getBingSearchQuery;
  readonly getOperatorDisplayName = getOperatorDisplayName;
  readonly getNotificationSourceLabel = getNotificationSourceLabel;
  readonly isGenericModel = isGenericHistoryModel;

  private readonly imageTooltip: MilitaryHistoryImageTooltip;

  constructor(
    private countryService: CountryService,
    private operatorTooltipService: OperatorTooltipService,
    aircraftImageService: AircraftImageService,
    cdr: ChangeDetectorRef,
  ) {
    this.imageTooltip = new MilitaryHistoryImageTooltip(
      aircraftImageService,
      cdr,
    );
  }

  get showImageTooltip() {
    return this.imageTooltip.showImageTooltip;
  }
  get isLoadingImage() {
    return this.imageTooltip.isLoadingImage;
  }
  get aircraftImage() {
    return this.imageTooltip.aircraftImage;
  }
  get tooltipPosition() {
    return this.imageTooltip.tooltipPosition;
  }

  getSortIcon(field: HistorySortField): string {
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

  onSort(field: HistorySortField) {
    this.sortChange.emit(field);
  }

  onModelMouseEnter(event: MouseEvent, sighting: MilitaryHistorySighting) {
    this.imageTooltip.onModelMouseEnter(event, sighting);
  }

  onModelMouseLeave() {
    this.imageTooltip.onModelMouseLeave();
  }

  @HostListener('document:scroll', [])
  onScroll() {
    if (this.showImageTooltip) this.onModelMouseLeave();
  }
}