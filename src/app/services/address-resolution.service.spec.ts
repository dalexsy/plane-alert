import { TestBed } from '@angular/core/testing';
import { AddressResolutionService } from './address-resolution.service';
import { SettingsService } from './settings.service';
import { ScanService } from './scan.service';
import { LocationContextService } from './location-context.service';

describe('AddressResolutionService', () => {
  let service: AddressResolutionService;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let scanService: jasmine.SpyObj<ScanService>;
  let locationContext: jasmine.SpyObj<LocationContextService>;

  beforeEach(() => {
    const settingsSpy = jasmine.createSpyObj('SettingsService', [
      'setRadius',
      'setLocationWithAddress',
    ]);
    const scanSpy = jasmine.createSpyObj('ScanService', ['forceScan']);
    const locationSpy = jasmine.createSpyObj('LocationContextService', [
      'updateFromAddress',
      'setLocation',
    ]);

    // Provide a default radius used by the service
    (settingsSpy as any).radius = 5;

    TestBed.configureTestingModule({
      providers: [
        AddressResolutionService,
        { provide: SettingsService, useValue: settingsSpy },
        { provide: ScanService, useValue: scanSpy },
        { provide: LocationContextService, useValue: locationSpy },
      ],
      teardown: { destroyAfterEach: true },
    });

    service = TestBed.inject(AddressResolutionService);
    settingsService = TestBed.inject(
      SettingsService
    ) as jasmine.SpyObj<SettingsService>;
    scanService = TestBed.inject(ScanService) as jasmine.SpyObj<ScanService>;
    locationContext = TestBed.inject(
      LocationContextService
    ) as jasmine.SpyObj<LocationContextService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('formatAddress', () => {
    it('should build a structured address from geocode details', () => {
      const input = 'klarastr 2 12459 berlin';
      const geocodeResult = {
        addressDetails: {
          road: 'Klarastraße',
          house_number: '2',
          suburb: 'Oberschöneweide',
          city_district: 'Treptow-Köpenick',
          city: 'Berlin',
          postcode: '12459',
          country: 'Germany',
        },
      };
      const expected =
        'Klarastraße 2, Oberschöneweide, Treptow-Köpenick, 12459 Berlin, Germany';
      const result = (service as any).formatAddress(input, geocodeResult);
      expect(result).toBe(expected);
    });

    it('should handle empty address', () => {
      const input = '';
      const expected = '';
      const result = (service as any).formatAddress(input);
      expect(result).toBe(expected);
    });

    it('should use display name when components missing', () => {
      const input = 'berlin germany';
      const geocodeResult = {
        displayName: 'Berlin, Germany',
      };
      const expected = 'Berlin, Germany';
      const result = (service as any).formatAddress(input, geocodeResult);
      expect(result).toBe(expected);
    });

    it('should fallback to basic formatting when no geocode result is provided', () => {
      const input = 'klarastraße 9a oberschöneweide berlin';
      const expected = 'Klarastraße 9A Oberschöneweide Berlin';
      const result = (service as any).formatAddress(input);
      expect(result).toBe(expected);
    });

    it('should remove comma between street and house number in basic formatting', () => {
      const input = 'klarastraße, 9a, oberschöneweide, berlin';
      const expected = 'Klarastraße 9A, Oberschöneweide, Berlin';
      const result = (service as any).formatAddress(input);
      expect(result).toBe(expected);
    });

    it('should reorder numbers that precede street names in display name', () => {
      const input = 'klarastr berlin';
      const geocodeResult = {
        displayName: '2, Klarastraße, Oberschöneweide, Berlin',
      };
      const expected = 'Klarastraße 2, Oberschöneweide, Berlin';
      const result = (service as any).formatAddress(input, geocodeResult);
      expect(result).toBe(expected);
    });

    it('should reorder numbers that precede street names in basic formatting', () => {
      const input = '2, klarastraße, oberschöneweide, berlin';
      const expected = 'Klarastraße 2, Oberschöneweide, Berlin';
      const result = (service as any).formatAddress(input);
      expect(result).toBe(expected);
    });
  });

  describe('resolveAndUpdateFromAddress', () => {
    it('should format and save the address without changing location', async () => {
      const mockInputOverlay = {
        addressInputRef: {
          getValue: () => 'klarastr 2 12459 berlin',
        },
        processRadiusChange: jasmine.createSpy(),
        currentAddress: '',
      };

      locationContext.updateFromAddress.and.returnValue(
        Promise.resolve({
          lat: 52.52,
          lon: 13.405,
          addressDetails: {
            road: 'Klarastraße',
            house_number: '2',
            suburb: 'Oberschöneweide',
            city_district: 'Treptow-Köpenick',
            city: 'Berlin',
            postcode: '12459',
            country: 'Germany',
          },
        })
      );

      await service.resolveAndUpdateFromAddress(
        mockInputOverlay,
        jasmine.createSpy(),
        10
      );

      expect(locationContext.updateFromAddress).toHaveBeenCalledWith(
        'klarastr 2 12459 berlin'
      );
      expect(locationContext.setLocation).toHaveBeenCalledWith(
        52.52,
        13.405,
        'Klarastraße 2, Oberschöneweide, Treptow-Köpenick, 12459 Berlin, Germany',
        'address'
      );
      expect(settingsService.setLocationWithAddress).toHaveBeenCalledWith(
        52.52,
        13.405,
        'Klarastraße 2, Oberschöneweide, Treptow-Köpenick, 12459 Berlin, Germany'
      );
      expect(scanService.forceScan).toHaveBeenCalled();
    });
  });
});
