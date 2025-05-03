import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LocationService],
    });
    service = TestBed.inject(LocationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return location information', () => {
    const mockResponse = {
      address: {
        road: 'Main Street',
        suburb: 'Downtown',
      },
    };

    service.getLocationInfo(51.5074, -0.1278).subscribe((result) => {
      expect(result.street).toBe('Main Street');
      expect(result.district).toBe('Downtown');
    });

    const req = httpMock.expectOne(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=51.5074&lon=-0.1278&zoom=18'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should handle API errors', () => {
    service.getLocationInfo(51.5074, -0.1278).subscribe((result) => {
      expect(result.street).toBeNull();
      expect(result.district).toBeNull();
    });

    const req = httpMock.expectOne(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=51.5074&lon=-0.1278&zoom=18'
    );
    req.error(new ErrorEvent('Network error'));
  });

  afterEach(() => {
    httpMock.verify();
  });
});
