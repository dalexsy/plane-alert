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

  it('should log unknown call signs', () => {
    const consoleSpy = spyOn(console, 'log');

    // Test with unknown call sign
    expect(service.getOperatorWithLogging('XYZ123')).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Unknown Call Sign] XYZ - Full callsign: XYZ123'
    );

    // Should only log once per prefix
    service.getOperatorWithLogging('XYZ456');
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    // Test with known call sign - should not log
    service.getOperatorWithLogging('CTN123');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('should track unknown call signs', () => {
    service.clearUnknownCallSigns();
    expect(service.getUnknownCallSigns()).toEqual([]);

    service.getOperatorWithLogging('ABC123');
    service.getOperatorWithLogging('DEF456');
    service.getOperatorWithLogging('ABC789'); // Same prefix, shouldn't duplicate

    const unknowns = service.getUnknownCallSigns();
    expect(unknowns).toEqual(['ABC', 'DEF']);
  });

  it('should clear unknown call signs', () => {
    service.getOperatorWithLogging('GHI123');
    expect(service.getUnknownCallSigns().length).toBeGreaterThan(0);

    service.clearUnknownCallSigns();
    expect(service.getUnknownCallSigns()).toEqual([]);
  });
});
