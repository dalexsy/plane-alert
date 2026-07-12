import { TestBed } from '@angular/core/testing';

import { AircraftDbService } from './aircraft-db.service';

describe('AircraftDbService', () => {
  let service: AircraftDbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AircraftDbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
