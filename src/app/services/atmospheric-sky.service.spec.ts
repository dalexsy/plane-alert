import { TestBed } from '@angular/core/testing';
import { AtmosphericSkyService } from './atmospheric-sky.service';

describe('AtmosphericSkyService', () => {
  let service: AtmosphericSkyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AtmosphericSkyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return night colors for negative sun elevation', () => {
    const result = service.calculateSkyColors(-10);
    expect(result.bottomColor).toContain('rgb(15, 20, 35)');
    expect(result.topColor).toContain('rgb(5, 10, 25)');
  });

  it('should return twilight colors for low positive sun elevation', () => {
    const result = service.calculateSkyColors(3);
    expect(result.bottomColor).toContain('rgb(');
    expect(result.topColor).toContain('rgb(');
    // Should be brighter than night but dimmer than day
  });

  it('should return day colors for normal sun elevation', () => {
    const result = service.calculateSkyColors(45);
    expect(result.bottomColor).toContain('rgb(');
    expect(result.topColor).toContain('rgb(');
  });

  it('should apply weather effects correctly', () => {
    const clearSky = service.calculateSkyColors(45, 'clear');
    const rainySky = service.calculateSkyColors(45, 'rain');

    // Rainy sky should be darker
    expect(rainySky.bottomColor).not.toEqual(clearSky.bottomColor);
    expect(rainySky.topColor).not.toEqual(clearSky.topColor);
  });

  it('should calculate turbidity correctly', () => {
    expect(service.calculateTurbidity('clear')).toBeCloseTo(1.5);
    expect(service.calculateTurbidity('fog')).toBeCloseTo(8.0);
    expect(service.calculateTurbidity('overcast')).toBeCloseTo(4.0);
  });

  it('should handle visibility-based turbidity', () => {
    const turbidity = service.calculateTurbidity(undefined, 10); // 10km visibility
    expect(turbidity).toBeGreaterThan(0);
    expect(turbidity).toBeLessThan(10);
  });
});
