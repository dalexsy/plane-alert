import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { MappingService } from './mapping.service';

describe('MappingService', () => {
  let service: MappingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MappingService],
    });
    service = TestBed.inject(MappingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch aircraft mapping data', () => {
    const mockData = [
      {
        icao: '123',
        reg: 'ABC123',
        icaotype: 'B737',
        year: 2010,
        manufacturer: 'Boeing',
        model: '737-800',
        ownop: 'Airline',
        faa_pia: false,
        faa_ladd: false,
        short_type: 'B737',
        mil: false,
      },
    ];

    service.getMapping().subscribe((data) => {
      expect(data).toEqual(mockData);
    });

    // Expect two requests for the split DB files
    const req1 = httpMock.expectOne('assets/basic-ac-db1.json');
    expect(req1.request.method).toBe('GET');
    // Return newline-delimited JSON lines for the first fragment
    const body1 = mockData.map((d) => JSON.stringify(d)).join('\n');
    req1.flush(body1);

    const req2 = httpMock.expectOne('assets/basic-ac-db2.json');
    expect(req2.request.method).toBe('GET');
    // Return empty for the second fragment
    req2.flush('');
  });
});
