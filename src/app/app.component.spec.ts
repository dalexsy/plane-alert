import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { NoonRefreshService } from './services/noon-refresh/noon-refresh.service';
import { NotificationService } from './services/notification/notification.service';
import { PushRegistrationService } from './services/push-registration/push-registration.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: NoonRefreshService, useValue: { start: () => undefined } },
        {
          provide: NotificationService,
          useValue: { evaluateStatus: () => Promise.resolve() },
        },
        {
          provide: PushRegistrationService,
          useValue: {
            getStoredUserKey: () => null,
            registerDevice: () => Promise.resolve(),
          },
        },
      ],
    })
      .overrideComponent(AppComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();
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
