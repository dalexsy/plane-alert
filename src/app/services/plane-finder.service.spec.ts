import { TestBed } from '@angular/core/testing';
import { PlaneFinderService } from './plane-finder.service';
import { SettingsService } from './settings.service';
import { EventEmitter } from '@angular/core';
import { PlaneDataService } from './plane-data.service';
import { PathCalculationService } from './path-calculation.service';
import { PlaneVisualizationService } from './plane-visualization.service';
import { TooltipUpdateService } from './tooltip-update.service';

describe('PlaneFinderService', () => {
  let service: PlaneFinderService;

  class MockSettingsService {
    distanceUnit = 'km';
    distanceUnitChanged = new EventEmitter<string>();
  }

  class MockPlaneDataService {}

  class MockPathCalculationService {}

  class MockPlaneVisualizationService {}

  class MockTooltipUpdateService {
    updateAllTooltipsForUnitChange() {}
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlaneFinderService,
        { provide: SettingsService, useClass: MockSettingsService },
        { provide: PlaneDataService, useClass: MockPlaneDataService },
        {
          provide: PathCalculationService,
          useClass: MockPathCalculationService,
        },
        {
          provide: PlaneVisualizationService,
          useClass: MockPlaneVisualizationService,
        },
        { provide: TooltipUpdateService, useClass: MockTooltipUpdateService },
      ],
    });
    service = TestBed.inject(PlaneFinderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ...other tests if any...
});
