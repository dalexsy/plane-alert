import { Injectable } from '@angular/core';
import { AstronomicalService } from './astronomical.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class AstronomicalDisplayService {
  // Astronomical display properties
  public sunAngle: number = 0;
  public isNight: boolean = false;
  public sunEventText: string = '';
  public moonFraction: number = 0;
  public moonIsWaning: boolean = false;
  public moonPhaseName: string = '';
  public moonTerminatorAngle: number = 0;
  public moonIcon: string = 'dark_mode';
  public moonIllumAngleDeg: number = 0;

  private sunAngleInterval: any;

  constructor(
    private astronomicalService: AstronomicalService,
    private settings: SettingsService
  ) {}

  /** Start periodic astronomical updates */
  public startAstronomicalUpdates(): void {
    // Initial update
    this.updateAstronomicalData();

    // Update every minute
    this.sunAngleInterval = setInterval(() => {
      this.updateAstronomicalData();
    }, 60000);
  }

  /** Stop periodic astronomical updates */
  public stopAstronomicalUpdates(): void {
    if (this.sunAngleInterval) {
      clearInterval(this.sunAngleInterval);
      this.sunAngleInterval = null;
    }
  }

  /** Update all astronomical data based on current location */
  public updateAstronomicalData(): void {
    const now = new Date();
    const lat = this.settings.lat ?? 52.3667;
    const lon = this.settings.lon ?? 13.5033;

    const astronomicalData = this.astronomicalService.calculateAstronomicalData(
      lat,
      lon,
      now
    );

    this.sunAngle = astronomicalData.sunAngle;
    this.isNight = astronomicalData.isNight;
    this.sunEventText = astronomicalData.sunEventText;
    this.moonFraction = astronomicalData.moonFraction;
    this.moonIsWaning = astronomicalData.moonIsWaning;
    this.moonPhaseName = astronomicalData.moonPhaseName;
    this.moonTerminatorAngle = astronomicalData.moonTerminatorAngle;

    // Update moon icon based on phase
    this.updateMoonIcon();
  }

  /** Update moon icon based on current phase */
  private updateMoonIcon(): void {
    if (this.moonFraction < 0.01) {
      this.moonIcon = 'dark_mode'; // New moon
    } else if (this.moonFraction < 0.25) {
      this.moonIcon = this.moonIsWaning ? 'brightness_3' : 'brightness_2'; // Crescent
    } else if (this.moonFraction < 0.75) {
      this.moonIcon = this.moonIsWaning ? 'brightness_4' : 'brightness_5'; // Quarter/Half
    } else {
      this.moonIcon = this.moonIsWaning ? 'brightness_6' : 'brightness_7'; // Gibbous
    }
  }

  /** Get the background color for the moon (dark side) */
  public getMoonBackgroundColor(): string {
    return '#000000';
  }

  /** Get the lit color for the moon (illuminated side) */
  public getMoonLitColor(): string {
    return '#d4d4d4';
  }

  /** Observer latitude (current map center latitude) */
  public get observerLat(): number {
    return this.settings.lat ?? 52.3667;
  }

  /** Observer longitude (current map center longitude) */
  public get observerLon(): number {
    return this.settings.lon ?? 13.5033;
  }
}
