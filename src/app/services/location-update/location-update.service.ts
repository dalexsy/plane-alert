import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { PushRegistrationService } from '../push-registration/push-registration.service';

@Injectable({
  providedIn: 'root',
})
export class LocationUpdateService {
  private autoUpdateInterval: any = null;
  private isAutoUpdateEnabled = false;
  lastUpdateTime: Date | null = null;

  constructor(
    private settings: SettingsService,
    private pushRegistration: PushRegistrationService
  ) {}

  /**
   * Check and update location automatically if setting is enabled
   */
  async checkAutoLocationUpdate(
    updateMapCallback: (lat: number, lon: number, radius: number) => void
  ): Promise<void> {
    if (!navigator.geolocation) {
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      const newLat = position.coords.latitude;
      const newLon = position.coords.longitude;
      const currentLat = this.settings.lat ?? 52.3667;
      const currentLon = this.settings.lon ?? 13.5033;

      // Check if location has changed significantly (more than ~10 meters)
      const latDiff = Math.abs(newLat - currentLat);
      const lonDiff = Math.abs(newLon - currentLon);
      const hasLocationChanged = latDiff > 0.0001 || lonDiff > 0.0001;

      if (hasLocationChanged) {
        console.log('📍 Location changed, updating:', { newLat, newLon });

        // Update frontend
        const currentMainRadius = this.settings.radius ?? 5;
        updateMapCallback(newLat, newLon, currentMainRadius);

        await this.pushRegistration.updateHomeLocation(newLat, newLon);

        this.lastUpdateTime = new Date();
      }
    } catch (error) {
      // Silently fail - don't show error messages during automatic updates
      console.debug('Auto-location update failed:', error);
    }
  }

  /**
   * Use current location to update the map
   */
  async useCurrentLocation(
    updateMapCallback: (lat: number, lon: number, radius: number) => void,
    inputOverlayComponent: any
  ): Promise<void> {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      // Use current main radius for update
      const currentMainRadius = this.settings.radius ?? 5;
      updateMapCallback(
        position.coords.latitude,
        position.coords.longitude,
        currentMainRadius
      );
    } catch (error) {
      // Fallback to default coordinates
      const currentMainRadius = this.settings.radius ?? 5;
      updateMapCallback(52.3667, 13.5033, currentMainRadius);
      if (inputOverlayComponent?.addressInputRef) {
        inputOverlayComponent.addressInputRef.setValue(
          'Unable to fetch location; using default'
        );
      }
    }
  }

  /**
   * Get current position with promise wrapper
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      });
    });
  }

  /**
   * Get current position for auto-updates (less accurate, longer cache)
   */
  private getCurrentPositionForAutoUpdate(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 30000,
      });
    });
  }

  /**
   * Start automatic location updates every 5 minutes
   */
  startAutoLocationUpdates(
    updateMapCallback: (lat: number, lon: number, radius: number) => void
  ): void {
    if (this.isAutoUpdateEnabled) {
      return; // Already running
    }

    console.log('🔄 Starting automatic location updates (every 5 minutes)');
    this.isAutoUpdateEnabled = true;
    this.lastUpdateTime = new Date();

    // Run immediately
    this.checkAutoLocationUpdate(updateMapCallback);

    // Then every 5 minutes
    this.autoUpdateInterval = setInterval(() => {
      this.checkAutoLocationUpdate(updateMapCallback);
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop automatic location updates
   */
  stopAutoLocationUpdates(): void {
    if (this.autoUpdateInterval) {
      console.log('⏸️ Stopping automatic location updates');
      clearInterval(this.autoUpdateInterval);
      this.autoUpdateInterval = null;
      this.isAutoUpdateEnabled = false;
    }
  }

  /**
   * Check if auto-updates are currently running
   */
  isAutoUpdateRunning(): boolean {
    return this.isAutoUpdateEnabled;
  }
}
