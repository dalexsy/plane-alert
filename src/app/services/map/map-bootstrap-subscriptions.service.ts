import { Injectable, ChangeDetectorRef } from '@angular/core';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { PlaneModel } from '../../models/plane-model';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapHostRefs } from './map-bootstrap.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { MapFollowHandlersService } from './map-follow-handlers.service';
import { MapCloudLayerFilterService } from './map-cloud-layer-filter.service';
import { SettingsService } from '../settings/settings.service';
import { FilterManagementService } from '../filter-management/filter-management.service';
import { PlaneFollowService } from '../plane-follow/plane-follow.service';
import { PlaneFilterService } from '../plane-filter/plane-filter.service';
import { AircraftDbService } from '../aircraft-db/aircraft-db.service';
import { PlaneLogService } from '../plane-log/plane-log.service';
import { ScanService } from '../scan/scan.service';
import { MapService } from './map.service';
import { AirportService } from '../airport/airport.service';
import { MapPanService } from '../map-pan/map-pan.service';
import { SkyColorSyncService } from '../sky-color-sync/sky-color-sync.service';
import { BrightnessService } from '../brightness/brightness.service';
import { MapThemeService } from '../map-theme/map-theme.service';
import { EnvironmentalDataService } from '../environmental-data/environmental-data.service';
import { UiStateService } from '../ui-state/ui-state.service';
import { SkyOverlayService } from '../sky-overlay/sky-overlay.service';

@Injectable({ providedIn: 'root' })
export class MapBootstrapSubscriptionsService {
  constructor(
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private settings: SettingsService,
    private filterManagementService: FilterManagementService,
    private planeFollowService: PlaneFollowService,
    private followHandlers: MapFollowHandlersService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private planeLogService: PlaneLogService,
    private scanService: ScanService,
    private planeOps: MapPlaneOperationsService,
    private mapService: MapService,
    private airportService: AirportService,
    private mapPanService: MapPanService,
    private skyColorSyncService: SkyColorSyncService,
    private cloudFilter: MapCloudLayerFilterService,
    private brightnessService: BrightnessService,
    private mapThemeService: MapThemeService,
    private environmentalData: EnvironmentalDataService,
    private uiState: UiStateService,
    private skyOverlayService: SkyOverlayService
  ) {}

  wire(refs: MapHostRefs, startLat: number, startLon: number): void {
    const { resultsOverlayComponent, inputOverlayComponent, cdr } = refs;

    this.settings.excludeDiscountChanged.subscribe(() => {
      this.filterManagementService.onExcludeDiscountChange(
        this.runtime.planeLog,
        this.runtime.planeHistoricalLog,
        this.runtime.map
      );
    });
    resultsOverlayComponent.clearHistoricalList.subscribe(() =>
      this.filterManagementService.clearSeenList(
        this.runtime.planeHistoricalLog,
        resultsOverlayComponent,
        cdr
      )
    );
    resultsOverlayComponent.exportFilterList.subscribe(() =>
      this.filterManagementService.exportFilterList()
    );

    this.planeFollowService.followState$.subscribe((followState) => {
      this.followHandlers.handleFollowStateChange(followState as { mode: string; followedPlaneIcao?: string | null }, cdr);
    });
    this.planeFollowService.follow$.subscribe((followRequest) => {
      this.followHandlers.handleFollowRequest(followRequest as { plane?: PlaneModel & PlaneLogEntry; fromShuffle?: boolean; fromNearest?: boolean }, cdr);
    });

    resultsOverlayComponent.filterPrefix.subscribe((plane: PlaneLogEntry) => {
      const prefix = this.planeFilter.extractAirlinePrefix(plane.callsign);
      this.planeFilter.togglePrefix(prefix);
      const planeModel = this.runtime.planeLog.get(plane.icao);
      if (planeModel) {
        const isMilitary = this.aircraftDb.lookup(planeModel.icao)?.mil || false;
        const shouldBeFiltered = !this.planeFilter.shouldIncludeCallsign(
          planeModel.callsign,
          this.settings.excludeDiscount,
          this.planeFilter.getFilterPrefixes(),
          isMilitary
        );
        planeModel.filteredOut = shouldBeFiltered;
        if (shouldBeFiltered) {
          planeModel.removeVisuals(this.runtime.map);
        } else if (planeModel.marker && !this.runtime.map.hasLayer(planeModel.marker)) {
          planeModel.marker.addTo(this.runtime.map);
        }
      }
      cdr.detectChanges();
      this.runtime.planeHistoricalLog.forEach((hist) => {
        const isMilHist = this.aircraftDb.lookup(hist.icao)?.mil || false;
        hist.filteredOut = !this.planeFilter.shouldIncludeCallsign(
          hist.callsign,
          this.settings.excludeDiscount,
          this.planeFilter.getFilterPrefixes(),
          isMilHist
        );
      });
      this.runtime.planeHistoricalLog = this.planeLogService.updatePlaneLog(
        Array.from(this.runtime.planeLog.values())
      );
    });

    this.scanService.start(this.settings.interval, () => {
      this.planeOps.findPlanes(inputOverlayComponent, cdr);
    });
    this.scanService.forceScan();

    this.settings.radiusChanged.subscribe((newRadius) => {
      const lat = this.settings.lat ?? this.runtime.DEFAULT_COORDS[0];
      const lon = this.settings.lon ?? this.runtime.DEFAULT_COORDS[1];
      this.mapService.setMainRadius(lat, lon, newRadius);
      this.planeOps.removeOutOfRangePlanes(lat, lon, newRadius);
      this.airportService.findAndDisplayAirports(
        lat,
        lon,
        newRadius,
        this.uiState.showAirportLabels
      );
    });

    this.mapPanService.init(this.runtime.map);
    this.skyColorSyncService.skyColors$.subscribe((skyColors) => {
      if (skyColors && this.runtime.cloudLayer) {
        this.cloudFilter.applySkyColorsToCloudLayer(skyColors);
      }
    });

    this.brightnessService.setLocation(startLat, startLon);
    // Theme already applied in MapInitializerService — do not re-init (full tile rebuild).
    this.environmentalData.setLocation(startLat, startLon);
    this.environmentalData.windData$.subscribe((windData) => {
      if (windData) {
        this.runtime.windSpeed = windData.speed;
        this.runtime.windAngle = windData.direction;
        this.runtime.windStat = windData.stat;
        cdr.detectChanges();
      }
    });
  }

  destroy(): void {
    this.scanService.stop();
    this.mapPanService.destroy();
    this.airportService.destroy();
    this.skyOverlayService.destroy();
    this.mapThemeService.destroy();
  }
}
