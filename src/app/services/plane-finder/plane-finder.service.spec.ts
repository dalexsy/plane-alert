import { TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PlaneFinderService } from './plane-finder.service';
import { NewPlaneService } from '../new-plane/new-plane.service';
import { SettingsService } from '../settings/settings.service';
import { HelicopterListService } from '../helicopter-list/helicopter-list.service';
import { SpecialListService } from '../special-list/special-list.service';
import { OperatorCallSignService } from '../operator-call-sign/operator-call-sign.service';

describe('PlaneFinderService', () => {
  let service: PlaneFinderService;

  // Mock classes
  class MockNewPlaneService {
    isNew = () => false;
    updatePlanes = () => {};
  }
  class MockSettingsService {
    distanceUnitChanged = new EventEmitter<string>();
  }
  class MockHelicopterListService {
    refreshHelicopterList = () => Promise.resolve(false);
  }
  class MockSpecialListService {
    refreshSpecialList = () => Promise.resolve();
  }
  class MockOperatorCallSignService {
    getOperator = () => undefined;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PlaneFinderService,
        { provide: NewPlaneService, useClass: MockNewPlaneService },
        { provide: SettingsService, useClass: MockSettingsService },
        { provide: HelicopterListService, useClass: MockHelicopterListService },
        { provide: SpecialListService, useClass: MockSpecialListService },
        {
          provide: OperatorCallSignService,
          useClass: MockOperatorCallSignService,
        },
      ],
    });
    service = TestBed.inject(PlaneFinderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ...other tests if any...
});
