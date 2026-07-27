import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AircraftDbService } from './aircraft-db.service';

describe('AircraftDbService', () => {
  let service: AircraftDbService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AircraftDbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
