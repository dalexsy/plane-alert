import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { SettingsService } from '../../services/settings/settings.service';
import { PushoverConfigEditorComponent } from '../pushover-config-editor/pushover-config-editor.component';
import { MilitaryHistoryPanelComponent } from '../military-history-panel/military-history-panel.component';
import { ResultsOverlayFacadeService } from '../../services/results/results-overlay-facade.service';
import { ResultsToolbarComponent } from '../results-toolbar/results-toolbar.component';
import { ResultsSkyListComponent } from './results-sky-list/results-sky-list.component';
import { ResultsSeenListComponent } from '../results-seen-list/results-seen-list.component';
import type { PlaneLogEntry } from '../../types/plane-log-entry';

export type { PlaneLogEntry } from '../../types/plane-log-entry';

@Component({
  selector: 'app-results-overlay',
  standalone: true,
  imports: [
    CommonModule,
    PushoverConfigEditorComponent,
    MilitaryHistoryPanelComponent,
    ResultsToolbarComponent,
    ResultsSkyListComponent,
    ResultsSeenListComponent,
  ],
  templateUrl: './results-overlay.component.html',
  styleUrls: ['./results-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ResultsOverlayComponent
  implements OnInit, OnChanges, OnDestroy, AfterViewInit
{
  @Input() skyPlaneLog: PlaneLogEntry[] = [];
  @Input() airportPlaneLog: PlaneLogEntry[] = [];
  @Input() seenPlaneLog: PlaneLogEntry[] = [];
  @Input() loadingAirports = false;
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() activePlaneIcaos: Set<string> = new Set();
  @Input() clickedAirports: Set<number> = new Set();
  @Input() airportCircles: Map<number, L.Circle> = new Map();
  @Input() showAltitudeBorders = false;
  @Input() showWindDirection = true;
  @Input() showSunDirection = true;

  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() exportFilterList = new EventEmitter<void>();
  @Output() clearHistoricalList = new EventEmitter<void>();
  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() altitudeBordersChange = new EventEmitter<boolean>();
  @Output() windDirectionToggleChange = new EventEmitter<boolean>();
  @Output() sunDirectionToggleChange = new EventEmitter<boolean>();
  @Output() windowViewToggle = new EventEmitter<boolean>();

  @ViewChild(ResultsSkyListComponent) skyList?: ResultsSkyListComponent;
  @ViewChild(ResultsSeenListComponent) seenList?: ResultsSeenListComponent;

  constructor(
    public cdr: ChangeDetectorRef,
    public settings: SettingsService,
    public facade: ResultsOverlayFacadeService
  ) {}

  ngOnInit(): void {
    this.facade.init(this.cdr);
  }

  ngAfterViewInit(): void {
    this.syncInputs();
    this.facade.applyPageTitle();
    setTimeout(() => this.updateScrollFade(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['skyPlaneLog'] ||
      changes['airportPlaneLog'] ||
      changes['highlightedPlaneIcao'] ||
      changes['seenPlaneLog'] ||
      changes['clickedAirports'] ||
      changes['airportCircles']
    ) {
      this.syncInputs();
    }
  }

  ngOnDestroy(): void {
    this.facade.destroy();
  }

  get collapsed(): boolean {
    return this.facade.collapsed;
  }

  private syncInputs(): void {
    this.facade.syncInputs(
      this.skyPlaneLog,
      this.airportPlaneLog,
      this.seenPlaneLog,
      this.highlightedPlaneIcao,
      this.clickedAirports,
      this.airportCircles
    );
    setTimeout(() => this.updateScrollFade(), 0);
  }

  onHoverPlane(plane: PlaneLogEntry, list: 'sky' | 'seen'): void {
    if (list === 'sky') this.facade.hoveredSkyPlaneIcao = plane.icao;
    else this.facade.hoveredSeenPlaneIcao = plane.icao;
    this.cdr.markForCheck();
    this.hoverPlane.emit(plane);
  }

  onUnhoverPlane(plane: PlaneLogEntry, list: 'sky' | 'seen'): void {
    if (list === 'sky') this.facade.hoveredSkyPlaneIcao = null;
    else this.facade.hoveredSeenPlaneIcao = null;
    this.cdr.markForCheck();
    this.unhoverPlane.emit(plane);
  }

  onToggleSpecial(plane: PlaneLogEntry): void {
    this.facade.toggleSpecial(plane, this.cdr);
  }

  onSkyScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.facade.skyListAtBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    this.updateScrollFade();
  }

  onSeenScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.facade.seenListAtBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    this.updateScrollFade();
  }

  updateScrollFade(): void {
    this.facade.updateScrollFade({
      sky: this.skyList?.listRef?.nativeElement,
      seen: this.seenList?.listRef?.nativeElement,
    });
    this.cdr.markForCheck();
  }

  onToggleSeenCollapsed(): void {
    this.facade.toggleSeenCollapsed(() => this.updateScrollFade());
  }

  toggleWindowView(): void {
    this.facade.showWindowView = !this.facade.showWindowView;
    this.windowViewToggle.emit(this.facade.showWindowView);
    this.cdr.detectChanges();
  }

  onPushoverConfigSaved(config: {
    ignoredTypes: string[];
    radiusKm: number;
  }): void {
    console.log('Pushover config saved:', config);
    this.facade.showPushoverConfig = false;
  }

  /** Public API for map component */
  triggerNewShuffle(): void {
    this.facade.triggerNewShuffle();
  }
}
