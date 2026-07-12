import { TestBed } from '@angular/core/testing';

import { PlaneFilterService } from './plane-filter.service';

describe('PlaneFilterService', () => {
  let service: PlaneFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlaneFilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
