import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, map, Observable, Subject } from 'rxjs';
import { PlaneDataOrchestratorService } from '../../services/plane-data-orchestrator.service';
import { EnvironmentalDataService } from '../../services/environmental-data.service';
import { MapStateManagerService } from '../../services/map-state-manager.service';
import { MapContainerFacadeService } from '../../services/map/map-container-facade.service';

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-container.component.html',
  styleUrls: ['./map-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  planeDataState$!: Observable<unknown>;
  environmentalState$!: Observable<unknown>;
  uiState$!: Observable<unknown>;
  uiToggles$!: Observable<unknown>;
  followState$!: Observable<unknown>;
  environmentalSettings$!: Observable<unknown>;
  isLoading$!: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(
    private planeDataOrchestrator: PlaneDataOrchestratorService,
    private environmentalData: EnvironmentalDataService,
    private mapStateManager: MapStateManagerService,
    public facade: MapContainerFacadeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.planeDataState$ = this.planeDataOrchestrator.state$;
    this.environmentalState$ = this.environmentalData.state$;
    this.uiState$ = this.mapStateManager.state$;
    this.uiToggles$ = this.mapStateManager.uiToggles$;
    this.followState$ = this.mapStateManager.followState$;
    this.environmentalSettings$ = this.mapStateManager.environmentalSettings$;
    this.isLoading$ = combineLatest([
      this.planeDataOrchestrator.isLoading$,
      this.environmentalData.state$.pipe(
        map((state: { isLoading: boolean }) => state.isLoading)
      ),
    ]).pipe(map(([a, b]) => a || b));
    this.facade.setupStateSubscriptions(this.destroy$);
    this.facade.checkUrlParameters();
  }

  ngAfterViewInit(): void {
    this.facade.initializeMap(this.cdr);
    this.facade.setupDataRefresh();
    this.facade.startAutoLocationTracking((e) => this.facade.onLocationChanged(e));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.facade.destroy();
  }

  onPlaneSelected(event: {
    icao: string;
    action: 'center' | 'follow' | 'info';
  }): void {
    this.facade.onPlaneSelected(event.icao, event.action);
  }

  onLocationChanged(event: {
    lat: number;
    lon: number;
    radius?: number;
    zoom?: number;
  }): void {
    this.facade.onLocationChanged(event);
  }

  onToggleChanged(event: { key: string; value: boolean }): void {
    this.facade.onToggleChanged(event.key, event.value);
  }

  onSettingChanged(event: { key: string; value: unknown }): void {
    this.facade.onSettingChanged(event.key, event.value);
  }

  onActionTriggered(event: { action: string }): void {
    this.facade.onAction(event.action);
  }
}
