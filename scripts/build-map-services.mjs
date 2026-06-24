#!/usr/bin/env node
/**
 * Extracts map.component.ts methods into injectable services.
 * Run: node scripts/build-map-services.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = join(ROOT, 'src/app/map/map.component.ts');
const SVC = join(ROOT, 'src/app/services/map');
if (!existsSync(SVC)) mkdirSync(SVC, { recursive: true });

const lines = readFileSync(MAP_FILE, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function indentBlock(block, spaces = 2) {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((l) => (l.trim() === '' ? '' : pad + l.replace(/^  /, '')))
    .join('\n');
}

function transformMethodToService(block, self = 'ctx') {
  return block
    .replace(/\bthis\./g, `${self}.`)
    .replace(/^  (async )?/, '  ')
    .replace(/^  private /, '  ')
    .replace(/^  public /, '  ');
}

const imports = `import { Injectable, ChangeDetectorRef, NgZone, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { haversineDistance } from '../../utils/geo-utils';
import { PlaneModel } from '../../models/plane-model';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { InputOverlayComponent } from '../../components/input-overlay/input-overlay.component';
import { ResultsOverlayComponent } from '../../components/results-overlay/results-overlay.component';
import { WindowViewOverlayComponent } from '../../components/window-view-overlay/window-view-overlay.component';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapCloudLayerFilterService } from './map-cloud-layer-filter.service';
import { addressLooksWrongForCoordinates } from './map-address-sync.util';
import { CountryService } from '../country.service';
import { MapService } from '../map.service';
import { PlaneFilterService } from '../plane-filter.service';
import { AircraftDbService } from '../aircraft-db.service';
import { SettingsService, ViewConeConfig } from '../settings.service';
import { ScanService } from '../scan.service';
import { SpecialListService } from '../special-list.service';
import { MapPanService } from '../map-pan.service';
import { SkyColorSyncService } from '../sky-color-sync.service';
import { LocationContextService } from '../location-context.service';
import { GeocodingCacheService } from '../geocoding-cache.service';
import { PlaneFollowService } from '../plane-follow.service';
import { FollowCoordinatorService } from '../follow-coordinator.service';
import { SkyOverlayService } from '../sky-overlay.service';
import { WeatherOverlayService } from '../weather-overlay.service';
import { MapThemeService } from '../map-theme.service';
import { BrightnessService } from '../brightness.service';
import { MapInitializerService } from '../map-initializer.service';
import { AirportService } from '../airport.service';
import { PlaneDisplayService } from '../plane-display.service';
import { PlaneLogService } from '../plane-log.service';
import { FollowService } from '../follow.service';
import { ClosestPlaneService } from '../closest-plane.service';
import { FilterManagementService } from '../filter-management.service';
import { AddressResolutionService } from '../address-resolution.service';
import { UiStateService } from '../ui-state.service';
import { AstronomicalDisplayService } from '../astronomical-display.service';
import { BrightnessDisplayService } from '../brightness-display.service';
import { PlaneUpdateService } from '../plane-update.service';
import { MapUpdateService } from '../map-update.service';
import { PlaneCenteringService } from '../plane-centering.service';
import { PlaneFilteringService } from '../plane-filtering.service';
import { EnvironmentalDataService } from '../environmental-data.service';
import { WindService } from '../wind.service';
`;

export interface MapActionContext {
  runtime: MapRuntimeService;
  overlay: MapOverlayStateService;
  inputOverlayComponent: InputOverlayComponent;
  resultsOverlayComponent: ResultsOverlayComponent;
  windowViewOverlayComponent: WindowViewOverlayComponent;
  cdr: ChangeDetectorRef;
  ngZone: NgZone;
  document: Document;
}

// --- map-bootstrap.service.ts ---
const bootstrapBody = slice(421, 832);
const bootstrapSvc = `${imports}
@Injectable({ providedIn: 'root' })
export class MapBootstrapService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    public countryService: CountryService,
    private mapService: MapService,
    private planeFilter: PlaneFilterService,
    private aircraftDb: AircraftDbService,
    private settings: SettingsService,
    private scanService: ScanService,
    private specialListService: SpecialListService,
    private mapPanService: MapPanService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private skyColorSyncService: SkyColorSyncService,
    private locationContext: LocationContextService,
    private geocodingCache: GeocodingCacheService,
    private planeFollowService: PlaneFollowService,
    private followCoordinatorService: FollowCoordinatorService,
    private skyOverlayService: SkyOverlayService,
    private weatherOverlayService: WeatherOverlayService,
    private mapThemeService: MapThemeService,
    private brightnessService: BrightnessService,
    private mapInitializerService: MapInitializerService,
    private airportService: AirportService,
    private planeDisplayService: PlaneDisplayService,
    private planeLogService: PlaneLogService,
    private followService: FollowService,
    private closestPlaneService: ClosestPlaneService,
    private filterManagementService: FilterManagementService,
    private addressResolution: AddressResolutionService,
    private uiState: UiStateService,
    private astronomicalDisplay: AstronomicalDisplayService,
    private brightnessDisplay: BrightnessDisplayService,
    private planeUpdate: PlaneUpdateService,
    private mapUpdate: MapUpdateService,
    private planeCentering: PlaneCenteringService,
    private planeFiltering: PlaneFilteringService,
    private environmentalData: EnvironmentalDataService,
    private cloudFilter: MapCloudLayerFilterService,
    private mapActions: MapActionsService,
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService
  ) {}

${transformMethodToService(bootstrapBody.replace('async ngAfterViewInit', 'async bootstrap'), 'ctx')
  .replace(/ngAfterViewInit/g, 'bootstrap')
  .replace(/this\.planeHistoricalLog/g, 'ctx.runtime.planeHistoricalLog')
  .replace(/this\.planeLog/g, 'ctx.runtime.planeLog')
  .replace(/this\.map/g, 'ctx.runtime.map')
  .replace(/this\.clickedAirports/g, 'ctx.overlay.clickedAirports')
  .replace(/this\.currentLocationMarker/g, 'ctx.runtime.currentLocationMarker')
  .replace(/this\.homeMarker/g, 'ctx.runtime.homeMarker')
  .replace(/this\.isProgrammaticMove/g, 'ctx.runtime.isProgrammaticMove')
  .replace(/this\.cloudLayer/g, 'ctx.runtime.cloudLayer')
  .replace(/this\.windSpeed/g, 'ctx.runtime') // fix later
}

  teardown(ctx: MapActionContext): void {
${indentBlock(slice(834, 849).replace(/ngOnDestroy/, 'teardown'))}
  }
}
`;

writeFileSync(join(SVC, 'map-bootstrap.service.ts'), bootstrapSvc);
console.log('Wrote map-bootstrap.service.ts', bootstrapSvc.split('\n').length, 'lines');
