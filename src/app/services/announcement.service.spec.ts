import { TestBed } from '@angular/core/testing';
import { AnnouncementService } from './announcement.service';
import { TtsService } from './tts.service';
import { CountryService } from './country.service';
import { LanguageSwitchService } from './language-switch.service';
import { SettingsService } from './settings.service';
import { AircraftCountryService } from './aircraft-country.service';
import { OperatorCallSignService } from './operator-call-sign.service';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';
import { fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let countryService: jasmine.SpyObj<CountryService>;
  let langSwitch: jasmine.SpyObj<LanguageSwitchService>;

  beforeEach(() => {
    const ttsServiceSpy = jasmine.createSpyObj('TtsService', ['speakOnce']);
    const countryServiceSpy = jasmine.createSpyObj('CountryService', [
      'getCountryName',
    ]);
    const langSwitchSpy = jasmine.createSpyObj('LanguageSwitchService', [
      'speakWithOverrides',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AnnouncementService,
        { provide: TtsService, useValue: ttsServiceSpy },
        { provide: CountryService, useValue: countryServiceSpy },
        { provide: LanguageSwitchService, useValue: langSwitchSpy },
        {
          provide: SettingsService,
          useValue: {
            militaryMute: false,
          },
        },
        {
          provide: AircraftCountryService,
          useValue: {
            getCountryFromCoordinates: () => ({ countryCode: 'Unknown' }),
          },
        },
        {
          provide: OperatorCallSignService,
          useValue: {
            getOperatorWithLogging: () => undefined,
          },
        },
      ],
      teardown: { destroyAfterEach: true },
    });

    service = TestBed.inject(AnnouncementService);
    countryService = TestBed.inject(
      CountryService
    ) as jasmine.SpyObj<CountryService>;
    langSwitch = TestBed.inject(
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

      expect(langSwitch.speakWithOverrides).not.toHaveBeenCalled();
    });

    it('should prioritize special model announcements', () => {
      const plane: PlaneLogEntry = {
        icao: 'TEST123',
        isNew: true,
        isMilitary: true,
        model: 'Hercules C-130',
      } as PlaneLogEntry;

      service.announceNewAircraft(plane, { isAirportClicked: false });

      expect(langSwitch.speakWithOverrides).toHaveBeenCalled();
      const [key, text] = (
        langSwitch.speakWithOverrides as jasmine.Spy
      ).calls.mostRecent().args;
      expect(key).toBe('aircraft-TEST123');
      expect(String(text)).toContain('Hercules');
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

      // Military announcements are queued briefly to group by country
      tick(350);

      expect(langSwitch.speakWithOverrides).toHaveBeenCalledWith(
        'aircraft-TEST123',
        'USAF F-16'
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

      expect(langSwitch.speakWithOverrides).toHaveBeenCalledWith(
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
