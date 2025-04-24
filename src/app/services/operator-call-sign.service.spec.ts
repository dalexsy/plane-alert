import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { OperatorCallSignService } from './operator-call-sign.service';

describe('OperatorCallSignService', () => {
  let service: OperatorCallSignService;
  let httpMock: HttpTestingController;
  const mockMapping = {
    CTN: 'Croatia Airlines',
    DLH: 'Deutsche Lufthansa',
    KLM: 'KLM Royal Dutch Airlines',
    RYR: 'Ryanair',
    XXX: 'Ryanair',
    LHX: 'Lufthansa City',
    EIN: 'Aer Lingus',
    NOZ: 'Norwegian Air',
    EJU: 'easyjet',
    ASL: 'GetJet Airlines',
    WUK: 'Wizz Air UK',
    AUA: 'Austrian Airlines',
    BTI: 'air Baltic',
    FHY: 'Freebird Airlines',
    AHY: 'Azerbaijan Airlines',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OperatorCallSignService],
    });
    service = TestBed.inject(OperatorCallSignService);
    httpMock = TestBed.inject(HttpTestingController);
    // Flush the JSON asset request
    httpMock.expectOne('assets/operator-call-signs.json').flush(mockMapping);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return correct operator for known call signs', () => {
    expect(service.getOperator('CTN123')).toBe('Croatia Airlines');
    expect(service.getOperator('ctn')).toBe('Croatia Airlines');
    expect(service.getOperator('XXX999')).toBe('Ryanair');
  });

  it('should return undefined for unknown call signs', () => {
    expect(service.getOperator('FOO123')).toBeUndefined();
    expect(service.getOperator('')).toBeUndefined();
    expect(service.getOperator(null as any)).toBeUndefined();
  });

  it('should list all initial mappings', () => {
    const mappings = service.getAllMappings();
    expect(mappings['DLH']).toBe('Deutsche Lufthansa');
    expect(mappings['ASL']).toBe('GetJet Airlines');
    expect(Object.keys(mappings).length).toBeGreaterThan(10);
  });

  it('should add and remove mappings correctly', () => {
    service.addMapping('TST', 'Test Airline');
    expect(service.getOperator('TST001')).toBe('Test Airline');
    service.removeMapping('TST');
    expect(service.getOperator('TST001')).toBeUndefined();
  });
});
