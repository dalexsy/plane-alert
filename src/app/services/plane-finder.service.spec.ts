import { TestBed } from '@angular/core/testing';

import { PlaneFinderService } from './plane-finder.service';

describe('PlaneFinderService', () => {
  let service: PlaneFinderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlaneFinderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
