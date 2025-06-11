import { TestBed } from '@angular/core/testing';
import { AnnouncementService } from './announcement.service';
import { TtsService } from './tts.service';
import { CountryService } from './country.service';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let ttsService: jasmine.SpyObj<TtsService>;
  let countryService: jasmine.SpyObj<CountryService>;

  beforeEach(() => {
    const ttsServiceSpy = jasmine.createSpyObj('TtsService', ['speakOnce']);
    const countryServiceSpy = jasmine.createSpyObj('CountryService', [
      'getCountryName',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AnnouncementService,
        { provide: TtsService, useValue: ttsServiceSpy },
        { provide: CountryService, useValue: countryServiceSpy },
      ],
    });

    service = TestBed.inject(AnnouncementService);
    ttsService = TestBed.inject(TtsService) as jasmine.SpyObj<TtsService>;
    countryService = TestBed.inject(
      CountryService
    ) as jasmine.SpyObj<CountryService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('announceNewAircraft', () => {
    it('should not announce if plane is not new', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: false,
        isMilitary: true,
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(ttsService.speakOnce).not.toHaveBeenCalled();
    });

    it('should prioritize special model announcements', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: true,
        model: 'Hercules C-130',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(ttsService.speakOnce).toHaveBeenCalledWith(
        'special-TEST123',
        'Hercules C-130',
        navigator.language
      );
    });

    it('should announce military aircraft when not special model', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: true,
        model: 'F-16',
        operator: 'USAF',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(ttsService.speakOnce).toHaveBeenCalledWith(
        'military-TEST123',
        'USAF F-16',
        navigator.language
      );
    });

    it('should use French locale for French military aircraft', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: true,
        model: 'Rafale',
        operator: "Armée de l'Air",
        origin: 'FR',
      } as PlaneLogEntry;

      countryService.getCountryName.and.returnValue('France');

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(ttsService.speakOnce).toHaveBeenCalledWith(
        'military-TEST123',
        "Armée de l'Air Rafale",
        'fr-FR'
      );
    });

    it('should announce airport arrivals for non-military planes at clicked airports', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: false,
        airportName: 'Frankfurt Airport',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: true });

      expect(ttsService.speakOnce).toHaveBeenCalledWith(
        'Frankfurt Airport',
        'Frankfurt Airport',
        'de-DE'
      );
    });
  });
  describe('isSpecialModelPublic', () => {
    it('should identify Hercules as special model', () => {
      const plane: PlaneLogEntry = {
        model: 'C-130 Hercules',
      } as PlaneLogEntry;

      expect(service.isSpecialModelPublic(plane)).toBe(true);
    });

    it('should identify A400 as special model', () => {
      const plane: PlaneLogEntry = {
        model: 'A400M Atlas',
      } as PlaneLogEntry;

      expect(service.isSpecialModelPublic(plane)).toBe(true);
    });

    it('should not identify regular aircraft as special model', () => {
      const plane: PlaneLogEntry = {
        model: 'Boeing 737',
      } as PlaneLogEntry;

      expect(service.isSpecialModelPublic(plane)).toBe(false);
    });
  });

  describe('isFrenchMilitaryAircraftPublic', () => {
    it('should identify French military aircraft', () => {
      const plane: PlaneLogEntry = {
        origin: 'FR',
      } as PlaneLogEntry;

      countryService.getCountryName.and.returnValue('France');

      expect(service.isFrenchMilitaryAircraftPublic(plane)).toBe(true);
    });

    it('should not identify non-French aircraft as French military', () => {
      const plane: PlaneLogEntry = {
        origin: 'US',
      } as PlaneLogEntry;

      countryService.getCountryName.and.returnValue('United States');

      expect(service.isFrenchMilitaryAircraftPublic(plane)).toBe(false);
    });
  });
});
