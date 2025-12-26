import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LocationOverlayComponent } from './location-overlay.component';
import { PlaneModel } from '../../models/plane-model';
import { DebouncedClickService } from '../../services/debounced-click.service';

describe('LocationOverlayComponent', () => {
  let component: LocationOverlayComponent;
  let fixture: ComponentFixture<LocationOverlayComponent>;

  const createMockPlane = () =>
    new PlaneModel({
      icao: 'ABC123',
      callsign: 'TEST123',
      lat: 51.5074,
      lon: -0.1278,
      origin: 'UK',
      firstSeen: Date.now(),
      model: 'B737',
      operator: 'Test Airways',
      bearing: 90,
      cardinal: 'E',
      arrow: '→',
      isNew: false,
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationOverlayComponent],
      providers: [
        {
          provide: DebouncedClickService,
          useValue: {
            debouncedClick: (_key: string, fn: () => void) => fn(),
          },
        },
      ],
      teardown: { destroyAfterEach: true },
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LocationOverlayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not display when no plane is provided', () => {
    component.plane = null;
    fixture.detectChanges();
    const overlayEl = fixture.debugElement.query(By.css('.location-overlay'));
    expect(overlayEl).toBeNull();
  });

  it('should show district when available', () => {
    component.plane = createMockPlane();
    component.district = 'Downtown';
    fixture.detectChanges();
    const districtEl = fixture.debugElement.query(By.css('.district'));
    expect(districtEl).withContext('Expected .district to exist').not.toBeNull();
    expect(districtEl!.nativeElement.textContent).toContain('Downtown');
  });

  it('should not show district element when district is not available', () => {
    component.plane = createMockPlane();
    component.district = null;
    fixture.detectChanges();
    const districtEl = fixture.debugElement.query(By.css('.district'));
    expect(districtEl).toBeNull();
  });

  it('should show airport name when plane has airport info', () => {
    component.plane = createMockPlane();
    (component.plane as any).airportName = 'Frankfurt Airport';
    (component.plane as any).onGround = true;
    component.district = null;
    fixture.detectChanges();

    const airportEl = fixture.debugElement.query(By.css('.airport-name'));
    expect(airportEl)
      .withContext('Expected .airport-name to exist')
      .not.toBeNull();
    expect(airportEl!.nativeElement.textContent).toContain('Frankfurt Airport');
  });

  it('should emit selectPlane event on click', () => {
    spyOn(component.selectPlane, 'emit');
    const mockPlane = createMockPlane();
    component.plane = mockPlane;
    component.district = 'Downtown';
    fixture.detectChanges();

    const overlayEl = fixture.debugElement.query(By.css('.location-overlay'));
    expect(overlayEl)
      .withContext('Expected .location-overlay to exist')
      .not.toBeNull();
    overlayEl!.nativeElement.click();

    expect(component.selectPlane.emit).toHaveBeenCalledWith(mockPlane);
  });
});
