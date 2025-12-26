import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputOverlayComponent } from './input-overlay.component';
import { SettingsService } from '../../services/settings.service';
import { ScanService } from '../../services/scan.service';
import { LocationContextService } from '../../services/location-context.service';
import { LocationUpdateService } from '../../services/location-update.service';
import { BehaviorSubject } from 'rxjs';
import { EventEmitter } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('InputOverlayComponent', () => {
  let component: InputOverlayComponent;
  let fixture: ComponentFixture<InputOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, InputOverlayComponent],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            inputOverlayCollapsed: true,
            inputOverlayCollapsedChanged: new EventEmitter<boolean>(),
            inputOverlayControlsHidden: false,
            inputOverlayControlsChanged: new EventEmitter<boolean>(),
            radius: 5,
            getFormattedIntervalDisplay: () => '60 seconds',
          },
        },
        {
          provide: ScanService,
          useValue: {
            countdown$: new BehaviorSubject<number>(0),
            isActive$: new BehaviorSubject<boolean>(false),
          },
        },
        {
          provide: LocationContextService,
          useValue: {
            currentLocation$: new BehaviorSubject<any>({
              address: 'Berlin, Germany',
              lat: 52.52,
              lon: 13.405,
              source: 'default',
              timestamp: Date.now(),
            }),
          },
        },
        {
          provide: LocationUpdateService,
          useValue: {},
        },
      ],
      teardown: { destroyAfterEach: true },
    }).compileComponents();

    fixture = TestBed.createComponent(InputOverlayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
