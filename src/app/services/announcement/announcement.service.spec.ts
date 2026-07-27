import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AnnouncementService } from './announcement.service';
import { TtsService } from '../tts/tts.service';
import { CountryService } from '../country/country.service';
import { LanguageSwitchService } from '../language-switch/language-switch.service';
import { SettingsService } from '../settings/settings.service';
import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let ttsService: jasmine.SpyObj<TtsService>;
  let countryService: jasmine.SpyObj<CountryService>;
  let languageSwitch: jasmine.SpyObj<LanguageSwitchService>;

  beforeEach(() => {
    const ttsServiceSpy = jasmine.createSpyObj('TtsService', ['speakOnce']);
    const countryServiceSpy = jasmine.createSpyObj('CountryService', [
      'getCountryName',
    ]);
    const languageSwitchSpy = jasmine.createSpyObj('LanguageSwitchService', [
      'speakWithOverrides',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AnnouncementService,
        { provide: TtsService, useValue: ttsServiceSpy },
        { provide: CountryService, useValue: countryServiceSpy },
        { provide: LanguageSwitchService, useValue: languageSwitchSpy },
        { provide: SettingsService, useValue: { militaryMute: false } },
      ],
    });

    service = TestBed.inject(AnnouncementService);
    ttsService = TestBed.inject(TtsService) as jasmine.SpyObj<TtsService>;
    countryService = TestBed.inject(
      CountryService
    ) as jasmine.SpyObj<CountryService>;
    languageSwitch = TestBed.inject(
      LanguageSwitchService
    ) as jasmine.SpyObj<LanguageSwitchService>;
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
        isMilitary: false,
        model: 'Hercules C-130',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(languageSwitch.speakWithOverrides).toHaveBeenCalledWith(
        'aircraft-TEST123',
        'Hercules C-130'
      );
    });

    it('should announce military aircraft when not special model', fakeAsync(() => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: true,
        model: 'F-16',
        operator: 'USAF',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });
      tick(300);

      expect(languageSwitch.speakWithOverrides).toHaveBeenCalledWith(
        'aircraft-TEST123',
        'USAF F-16'
      );
    }));

    it('should announce French military aircraft', fakeAsync(() => {
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
      tick(300);

      expect(languageSwitch.speakWithOverrides).toHaveBeenCalledWith(
        'aircraft-TEST123',
        "Armée de l'Air Rafale"
      );
    }));

    it('should announce airport arrivals for non-military planes at clicked airports', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: false,
        airportName: 'Frankfurt Airport',
        origin: 'DE',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: true });

      expect(languageSwitch.speakWithOverrides).toHaveBeenCalledWith(
        'aircraft-TEST123',
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
