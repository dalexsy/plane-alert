import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LocationOverlayComponent } from './location-overlay.component';
import { PlaneModel } from '../../models/plane-model';

describe('LocationOverlayComponent', () => {
  let component: LocationOverlayComponent;
  let fixture: ComponentFixture<LocationOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationOverlayComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LocationOverlayComponent);
    component = fixture.componentInstance;

    // Create mock plane data
    const mockPlane = new PlaneModel({
      icao: 'ABC123',
      callsign: 'TEST123',
      lat: 51.5074,
      lon: -0.1278,
    });

    component.plane = mockPlane;
    fixture.detectChanges();
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

  it('should show street information when available', () => {
    component.street = 'Main Street';
    fixture.detectChanges();
    const streetEl = fixture.debugElement.query(By.css('.street'));
    expect(streetEl.nativeElement.textContent).toContain('Main Street');
  });

  it('should show "Unknown" when street is not available', () => {
    component.street = null;
    fixture.detectChanges();
    const streetEl = fixture.debugElement.query(By.css('.street'));
    expect(streetEl.nativeElement.textContent).toContain('Unknown');
  });

  it('should show district when available', () => {
    component.district = 'Downtown';
    fixture.detectChanges();
    const districtEl = fixture.debugElement.query(By.css('.district'));
    expect(districtEl.nativeElement.textContent).toContain('Downtown');
  });

  it('should not show district element when district is not available', () => {
    component.district = null;
    fixture.detectChanges();
    const districtEl = fixture.debugElement.query(By.css('.district'));
    expect(districtEl).toBeNull();
  });

  it('should emit selectPlane event on click', () => {
    spyOn(component.selectPlane, 'emit');
    const mockPlane = new PlaneModel({
      icao: 'ABC123',
      callsign: 'TEST123',
      lat: 51.5074,
      lon: -0.1278,
    });
    component.plane = mockPlane;
    fixture.detectChanges();

    const overlayEl = fixture.debugElement.query(By.css('.location-overlay'));
    overlayEl.nativeElement.click();

    expect(component.selectPlane.emit).toHaveBeenCalledWith(mockPlane);
  });
});
