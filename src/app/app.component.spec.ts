import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { NoonRefreshService } from './services/noon-refresh.service';
import {
  NotificationService,
  NotificationStatusInfo,
} from './services/notification.service';
import { FirebaseMessagingService } from './services/firebase-messaging.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: NoonRefreshService,
          useValue: {
            start: () => {},
          },
        },
        {
          provide: NotificationService,
          useValue: {
            evaluateStatus: async () =>
              ({
                state: 'prompt',
                icon: '',
                label: '',
                details: '',
                canRequest: false,
                canTest: false,
              } as NotificationStatusInfo),
            requestPermission: async () => 'default',
            showMilitaryPlaneNotification: () => {},
          },
        },
        {
          provide: FirebaseMessagingService,
          useValue: {
            getStoredUserKey: () => null,
            registerDevice: async () => false,
          },
        },
      ],
    });

    TestBed.overrideComponent(AppComponent, {
      set: {
        template: '',
        imports: [],
      },
    });

    await TestBed.compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'plane-alert'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('plane-alert');
  });
});
