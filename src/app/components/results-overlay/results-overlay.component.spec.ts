import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultsOverlayComponent } from './results-overlay.component';
import { SettingsService } from '../../services/settings.service';
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SpecialListService } from '../../services/special-list.service';
import { AircraftDbService } from '../../services/aircraft-db.service';
import { ScanService } from '../../services/scan.service';
import { PlaneFollowService } from '../../services/plane-follow.service';
import { AutoFollowService } from '../../services/auto-follow.service';
import { FollowCoordinatorService } from '../../services/follow-coordinator.service';
import { OperatorCallSignService } from '../../services/operator-call-sign.service';
import { UrlParameterService } from '../../services/url-parameter.service';
import { Subject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ResultsOverlayComponent', () => {
  let component: ResultsOverlayComponent;
  let fixture: ComponentFixture<ResultsOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ResultsOverlayComponent],
      providers: [
        { provide: SettingsService, useValue: { seenCollapsed: false } },
        {
          provide: CountryService,
          useValue: { getCountryName: () => undefined },
        },
        { provide: PlaneFilterService, useValue: {} },
        {
          provide: SpecialListService,
          useValue: {
            specialListUpdated$: new Subject<void>(),
          },
        },
        { provide: AircraftDbService, useValue: {} },
        { provide: ScanService, useValue: {} },
        { provide: PlaneFollowService, useValue: {} },
        { provide: AutoFollowService, useValue: {} },
        { provide: FollowCoordinatorService, useValue: {} },
        { provide: OperatorCallSignService, useValue: {} },
        { provide: UrlParameterService, useValue: {} },
      ],
      teardown: { destroyAfterEach: true },
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsOverlayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
