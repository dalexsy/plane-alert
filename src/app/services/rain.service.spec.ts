import { TestBed } from '@angular/core/testing';
import { RainService, RainConfiguration } from './rain.service';
import { take } from 'rxjs/operators';

describe('RainService', () => {
  let service: RainService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RainService);
  });

  afterEach(() => {
    service.dispose();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default configuration', (done) => {
    service
      .getConfiguration()
      .pipe(take(1))
      .subscribe((config) => {
        expect(config).toBeDefined();
        expect(config.dropCount).toBe(150);
        expect(config.intensity).toBe(0.7);
        expect(config.windAngle).toBe(0);
        expect(config.fallSpeed).toBe(800);
        done();
      });
  });

  it('should not be raining initially', (done) => {
    service
      .getIsRaining()
      .pipe(take(1))
      .subscribe((isRaining) => {
        expect(isRaining).toBe(false);
        done();
      });
  });

  it('should start rain when weather conditions indicate rain', () => {
    spyOn(service, 'startRain');

    service.updateWeatherConditions('Rain', 'moderate rain', 5, 180);

    expect(service.startRain).toHaveBeenCalled();
  });

  it('should stop rain when weather conditions clear', () => {
    spyOn(service, 'stopRain');

    service.updateWeatherConditions('Clear', 'clear sky', 0, 0);

    expect(service.stopRain).toHaveBeenCalled();
  });

  it('should activate rain for various rain conditions', () => {
    const rainConditions = [
      { condition: 'Rain', description: 'light rain' },
      { condition: 'Drizzle', description: 'light intensity drizzle' },
      { condition: 'Thunderstorm', description: 'thunderstorm with rain' },
    ];

    spyOn(service, 'startRain');

    rainConditions.forEach(({ condition, description }) => {
      service.updateWeatherConditions(condition, description, 0, 0);
      expect(service.startRain).toHaveBeenCalled();
      (service.startRain as jasmine.Spy).calls.reset();
    });
  });

  it('should calculate correct intensity for different rain types', () => {
    const drizzle = service.getIntensityForDescription('drizzle');
    const light = service.getIntensityForDescription('light rain');
    const moderate = service.getIntensityForDescription('moderate rain');
    const heavy = service.getIntensityForDescription('heavy rain');

    // Intensity includes atmospheric modifiers, so assert ordering + bounds
    [drizzle, light, moderate, heavy].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
    expect(drizzle).toBeLessThanOrEqual(light);
    expect(light).toBeLessThanOrEqual(moderate);
    expect(moderate).toBeLessThanOrEqual(heavy);
  });

  it('should update configuration correctly', (done) => {
    const newConfig: Partial<RainConfiguration> = {
      dropCount: 200,
      intensity: 0.9,
      windAngle: 15,
    };

    service.startRain(newConfig);

    service
      .getConfiguration()
      .pipe(take(1))
      .subscribe((config) => {
        expect(config.dropCount).toBe(200);
        expect(config.intensity).toBe(0.9);
        expect(config.windAngle).toBe(15);
        done();
      });
  });

  it('should generate rain drops when starting rain', (done) => {
    service.startRain({ dropCount: 50 });
    service
      .getRainDrops()
      .pipe(take(1))
      .subscribe((drops) => {
        expect(drops.length).toBe(50);
        expect(drops[0].id).toBeDefined();
        expect(drops[0].x).toBeDefined();
        expect(drops[0].y).toBeDefined();
        expect(drops[0].size).toBeDefined();
        expect(drops[0].speed).toBeDefined();
        expect(drops[0].opacity).toBeDefined();
        done();
      });
  });

  it('should set isRaining to true when starting rain', (done) => {
    service.startRain();

    service
      .getIsRaining()
      .pipe(take(1))
      .subscribe((isRaining) => {
        expect(isRaining).toBe(true);
        done();
      });
  });

  it('should set isRaining to false when stopping rain', (done) => {
    service.startRain();
    service.stopRain();

    service
      .getIsRaining()
      .pipe(take(1))
      .subscribe((isRaining) => {
        expect(isRaining).toBe(false);
        done();
      });
  });

  it('should handle wind effects correctly', () => {
    // 0 wind => ~0 angle
    service.updateWeatherConditions('Rain', 'rain', 0, 0);
    service
      .getConfiguration()
      .pipe(take(1))
      .subscribe((config) => {
        expect(Math.abs(config.windAngle)).toBeLessThan(1);
      });

    // Opposing wind directions should produce opposing tilt directions.
    service.updateWeatherConditions('Rain', 'rain', 10, 270);
    let angle270 = 0;
    service
      .getConfiguration()
      .pipe(take(1))
      .subscribe((config) => {
        angle270 = config.windAngle;
        expect(Math.abs(config.windAngle)).toBeLessThanOrEqual(45);
      });

    service.updateWeatherConditions('Rain', 'rain', 10, 90);
    let angle90 = 0;
    service
      .getConfiguration()
      .pipe(take(1))
      .subscribe((config) => {
        angle90 = config.windAngle;
        expect(Math.abs(config.windAngle)).toBeLessThanOrEqual(45);
      });

    // Both should be non-zero and opposite in sign.
    expect(Math.abs(angle270)).toBeGreaterThan(0);
    expect(Math.abs(angle90)).toBeGreaterThan(0);
    expect(Math.sign(angle270)).toBe(-Math.sign(angle90));
  });

  it('should handle edge cases in weather conditions', () => {
    // Null/undefined conditions
    expect(() => service.updateWeatherConditions(null, null)).not.toThrow();
    expect(() => service.updateWeatherConditions('', '')).not.toThrow();

    // Invalid wind parameters
    expect(() =>
      service.updateWeatherConditions('Rain', 'rain', -1, 400)
    ).not.toThrow();
  });

  it('should create valid rain drops with proper bounds', (done) => {
    service.startRain({ dropCount: 10 });

    service
      .getRainDrops()
      .pipe(take(1))
      .subscribe((drops) => {
        drops.forEach((drop) => {
          expect(drop.x).toBeGreaterThanOrEqual(-10);
          expect(drop.x).toBeLessThanOrEqual(110);
          expect(drop.y).toBeLessThanOrEqual(-5);
          expect(drop.size).toBeGreaterThan(0);
          expect(drop.speed).toBeGreaterThan(0);
          expect(drop.opacity).toBeGreaterThanOrEqual(0);
          expect(drop.opacity).toBeLessThanOrEqual(1);
          expect(drop.delay).toBeGreaterThanOrEqual(0);
          expect(drop.duration).toBeGreaterThan(0);
        });
        done();
      });
  });

  it('should update drop count when configuration changes significantly', () => {
    service.startRain({ dropCount: 100 });

    service.updateConfiguration({ dropCount: 150 }); // Significant change (+50)

    service
      .getRainDrops()
      .pipe(take(1))
      .subscribe((drops) => {
        expect(drops.length).toBe(150);
      });
  });

  it('should not regenerate drops for minor configuration changes', () => {
    service.startRain({ dropCount: 100 });
    const originalDrops = service.getRainDrops().pipe(take(1));

    service.updateConfiguration({ opacity: 0.8 }); // Minor change

    service
      .getRainDrops()
      .pipe(take(1))
      .subscribe((drops) => {
        expect(drops.length).toBe(100); // Should keep same drops
      });
  });

  it('should handle disposal correctly', () => {
    service.startRain();

    expect(() => service.dispose()).not.toThrow();

    // Should not emit after disposal
    let emissionCount = 0;
    service.getIsRaining().subscribe(() => emissionCount++);

    expect(emissionCount).toBe(0);
  });

  it('should map weather descriptions to correct intensities', () => {
    const drizzle = service.getIntensityForDescription('light intensity drizzle');
    const light = service.getIntensityForDescription('light rain');
    const moderate = service.getIntensityForDescription('moderate rain');
    const heavy = service.getIntensityForDescription('heavy intensity rain');
    const thunder = service.getIntensityForDescription('thunderstorm with heavy rain');

    expect(drizzle).toBeLessThanOrEqual(light);
    expect(light).toBeLessThanOrEqual(moderate);
    expect(moderate).toBeLessThanOrEqual(heavy);
    expect(heavy).toBeLessThanOrEqual(thunder);
  });

  it('should handle animation frame cleanup properly', () => {
    spyOn(window, 'cancelAnimationFrame');

    service.startRain();
    service.stopRain();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });
});
