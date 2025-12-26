import { TestBed } from '@angular/core/testing';
import { AtmosphericSkyService } from './atmospheric-sky.service';

describe('AtmosphericSkyService', () => {
  let service: AtmosphericSkyService;

  function parseRgb(color: string): [number, number, number] | null {
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  function brightness([r, g, b]: [number, number, number]): number {
    // Simple perceived brightness; good enough for relative assertions
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AtmosphericSkyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return night colors for negative sun elevation', () => {
    const result = service.calculateSkyColors(-10);
    expect(result.bottomColor).toContain('rgb(');
    expect(result.topColor).toContain('rgb(');

    const nightBottom = parseRgb(result.bottomColor);
    const dayBottom = parseRgb(service.calculateSkyColors(45).bottomColor);
    expect(nightBottom).toBeTruthy();
    expect(dayBottom).toBeTruthy();
    expect(brightness(nightBottom!)).toBeLessThan(brightness(dayBottom!));
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
    const clearBottom = parseRgb(clearSky.bottomColor);
    const rainyBottom = parseRgb(rainySky.bottomColor);
    expect(clearBottom).toBeTruthy();
    expect(rainyBottom).toBeTruthy();
    expect(brightness(rainyBottom!)).toBeLessThan(brightness(clearBottom!));
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
