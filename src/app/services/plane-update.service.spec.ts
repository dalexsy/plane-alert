import { TestBed } from '@angular/core/testing';
import { PlaneUpdateService } from './plane-update.service';
import { SettingsService } from './settings.service';
import { PlaneFinderService } from './plane-finder.service';
import { PlaneFilterService } from './plane-filter.service';
import { AircraftDbService } from './aircraft-db.service';
import { PlaneLogService } from './plane-log.service';
import { ClosestPlaneService } from './closest-plane.service';
import { FollowService } from './follow.service';
import { LocationUpdateService } from './location-update.service';
import { CountryService } from './country.service';
import { SpecialListService } from './special-list.service';
import { NotificationService } from './notification.service';
import { TooltipUpdateService } from './tooltip-update.service';
import type { PlaneModel } from '../models/plane-model';

describe('PlaneUpdateService (location/radius correctness)', () => {
  let service: PlaneUpdateService;
  let settings: SettingsService;
  let planeFinder: MockPlaneFinderService;

  class MockPlaneFinderService {
    findPlanes = jasmine.createSpy('findPlanes').and.callFake(async () => ({
      anyNew: false,
      currentIDs: [],
      updatedLog: [],
    }));
  }

  class MockPlaneFilterService {
    getFilterPrefixes(): string[] {
      return [];
    }
    shouldIncludeCallsign(): boolean {
      return true;
    }
  }

  class MockAircraftDbService {
    lookup(): any {
      return null;
    }
  }

  class MockPlaneLogService {
    updatePlaneLog(): any[] {
      return [];
    }
  }

  class MockClosestPlaneService {
    computeClosestPlane() {}
    getClosestPlaneData() {
      return {
        closestPlane: null,
        closestDistance: null,
        closestOperator: null,
        closestSecondsAway: null,
        closestVelocity: null,
        locationStreet: null,
        locationDistrict: null,
      };
    }
  }

  class MockFollowService {
    trackFollowedPlane() {}
  }

  class MockLocationUpdateService {
    checkAutoLocationUpdate() {}
  }

  class MockCountryService {
    getFlagHTML(): string {
      return '';
    }
  }

  class MockSpecialListService {}

  class MockNotificationService {
    showMilitaryPlaneNotification() {}
  }

  class MockTooltipUpdateService {
    updateTooltipForPlaneNow() {}
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlaneUpdateService,
        SettingsService,
        { provide: PlaneFinderService, useClass: MockPlaneFinderService },
        { provide: PlaneFilterService, useClass: MockPlaneFilterService },
        { provide: AircraftDbService, useClass: MockAircraftDbService },
        { provide: PlaneLogService, useClass: MockPlaneLogService },
        { provide: ClosestPlaneService, useClass: MockClosestPlaneService },
        { provide: FollowService, useClass: MockFollowService },
        { provide: LocationUpdateService, useClass: MockLocationUpdateService },
        { provide: CountryService, useClass: MockCountryService },
        { provide: SpecialListService, useClass: MockSpecialListService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: TooltipUpdateService, useClass: MockTooltipUpdateService },
      ],
    });

    service = TestBed.inject(PlaneUpdateService);
    settings = TestBed.inject(SettingsService);
    planeFinder = TestBed.inject(
      PlaneFinderService
    ) as unknown as MockPlaneFinderService;

    // Default center: Berlin-ish
    settings.setLat(52.52);
    settings.setLon(13.405);
    settings.setRadius(10);
  });

  it('removes planes immediately when they are outside current radius', async () => {
    const farPlane = {
      icao: 'FAR1',
      lat: 40.6892, // NYC
      lon: -74.0445,
      firstSeen: Date.now() - 60_000,
      positionHistory: [{ lat: 40.6892, lon: -74.0445, timestamp: Date.now() }],
      isStale: false,
      removeVisuals: jasmine.createSpy('removeVisuals'),
    } as unknown as PlaneModel;

    const planeLog = new Map<string, PlaneModel>([['FAR1', farPlane]]);

    await service.findPlanes(
      {} as any,
      planeLog,
      [],
      new Map<string, number>(),
      new Set<string>(),
      null,
      false,
      { detectChanges() {} } as any
    );

    expect(planeFinder.findPlanes).toHaveBeenCalled();
    expect(farPlane.removeVisuals).toHaveBeenCalled();
    expect(planeLog.has('FAR1')).toBeFalse();
  });

  it('keeps within-radius planes briefly as stale when missing from the latest scan', async () => {
    const nearbyPlane = {
      icao: 'NEAR1',
      lat: 52.53,
      lon: 13.41,
      firstSeen: Date.now() - 60_000,
      positionHistory: [{ lat: 52.53, lon: 13.41, timestamp: Date.now() }],
      isStale: false,
      removeVisuals: jasmine.createSpy('removeVisuals'),
    } as unknown as PlaneModel;

    const planeLog = new Map<string, PlaneModel>([['NEAR1', nearbyPlane]]);

    await service.findPlanes(
      {} as any,
      planeLog,
      [],
      new Map<string, number>(),
      new Set<string>(),
      null,
      false,
      { detectChanges() {} } as any
    );

    // It should not be removed; it should be marked stale.
    expect(nearbyPlane.removeVisuals).not.toHaveBeenCalled();
    expect(planeLog.has('NEAR1')).toBeTrue();
    expect((planeLog.get('NEAR1') as any).isStale).toBeTrue();
  });

  it('preserves live-feed military flag (does not overwrite from DB)', async () => {
    const milPlane = {
      icao: 'MIL1',
      callsign: 'UKR61577',
      origin: 'UA',
      firstSeen: Date.now() - 60_000,
      lat: 52.53,
      lon: 13.41,
      positionHistory: [{ lat: 52.53, lon: 13.41, timestamp: Date.now() }],
      isMilitary: true,
      isSpecial: false,
      isNew: false,
      isStale: false,
      filteredOut: false,
      updateFrom() {},
      removeVisuals: jasmine.createSpy('removeVisuals'),
    } as unknown as PlaneModel;

    planeFinder.findPlanes.and.callFake(async () => ({
      anyNew: false,
      currentIDs: ['MIL1'],
      updatedLog: [milPlane],
    }));

    const planeLog = new Map<string, PlaneModel>();

    const result = await service.findPlanes(
      {} as any,
      planeLog,
      [],
      new Map<string, number>(),
      new Set<string>(),
      null,
      false,
      { detectChanges() {} } as any
    );

    expect(result.updatedLog.length).toBe(1);
    expect(result.updatedLog[0].isMilitary).toBeTrue();
    expect(planeLog.get('MIL1')?.isMilitary).toBeTrue();
    expect(result.faviconUrl).toContain('/military/');
  });
});
