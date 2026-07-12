import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../ui/button/button.component';
import { TabComponent } from '../ui/tab/tab.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { SettingsService } from '../../services/settings/settings.service';
import { ResultsOverlayFacadeService } from '../../services/results/results-overlay-facade.service';

@Component({
  selector: 'app-results-toolbar',
  standalone: true,
  imports: [CommonModule, ButtonComponent, TabComponent, TooltipDirective],
  templateUrl: './results-toolbar.component.html',
  styleUrls: ['./results-toolbar.component.scss'],
})
export class ResultsToolbarComponent {
  @Input({ required: true }) facade!: ResultsOverlayFacadeService;
  @Input() showAltitudeBorders = false;
  @Input() showWindDirection = true;
  @Input() showSunDirection = true;
  @Output() altitudeBordersChange = new EventEmitter<boolean>();
  @Output() windDirectionToggleChange = new EventEmitter<boolean>();
  @Output() sunDirectionToggleChange = new EventEmitter<boolean>();
  @Output() windowViewToggle = new EventEmitter<boolean>();
  @Output() configurePushover = new EventEmitter<void>();
  @Output() openMilitaryHistory = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() toggleOtherControls = new EventEmitter<void>();
  @Output() toggleCommercialFilter = new EventEmitter<void>();
  @Output() toggleMilitaryMute = new EventEmitter<void>();
  @Output() toggleShuffle = new EventEmitter<void>();
  @Output() toggleNearest = new EventEmitter<void>();
  @Output() toggleMilitaryPriority = new EventEmitter<void>();
  @Output() toggleWindowView = new EventEmitter<void>();

  constructor(public settings: SettingsService) {}

  get collapseTooltip(): string {
    return this.facade.collapsed ? 'Expand results' : 'Collapse results';
  }

  get commercialFilterTooltip(): string {
    return this.settings.excludeDiscount
      ? 'Show commercial'
      : 'Hide commercial';
  }

  get militaryMuteTooltip(): string {
    return this.facade.militaryMute
      ? 'Unmute military alerts'
      : 'Mute military alerts';
  }

  get altitudeBordersTooltip(): string {
    return this.showAltitudeBorders
      ? 'Hide altitude-colored borders'
      : 'Show altitude-colored borders';
  }

  get windDirectionTooltip(): string {
    return this.showWindDirection ? 'Hide wind direction' : 'Show wind direction';
  }

  get sunDirectionTooltip(): string {
    return this.showSunDirection ? 'Hide sun direction' : 'Show sun direction';
  }

  get shuffleTooltip(): string {
    return this.facade.shuffleMode ? 'Disable shuffle mode' : 'Enable shuffle mode';
  }

  get nearestTooltip(): string {
    return this.facade.nearestMode
      ? 'Disable nearest follow'
      : 'Enable nearest follow';
  }

  get militaryPriorityTooltip(): string {
    return this.facade.militaryPriority
      ? 'Disable military priority'
      : 'Enable military priority';
  }
}
